import Parser from "rss-parser";
import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";
import { promises as fs } from "fs";
import path from "path";

const FEEDS_PATH = path.resolve("config", "feeds-openclaw.json");
const DATA_DIR = path.resolve("data");
const DATE_FMT = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo" });

const parser = new Parser();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

interface BaseSource {
  id: string;
  type: string;
  tags?: string[];
  limit?: number;
}

interface RssSource extends BaseSource {
  type: "rss";
  url: string;
}

interface GithubSource extends BaseSource {
  type: "github";
  repo: string;
  filters?: { events?: string[] };
}

interface DiscordSource extends BaseSource {
  type: "discord";
  channelId: string;
  guildId?: string;
}

type Source = RssSource | GithubSource | DiscordSource;

type FeedConfig = {
  sources: Source[];
};

type Item = {
  id: string;
  source: string;
  title: string;
  url: string;
  content: string;
  tags: string[];
  capturedAt: string;
};

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

async function collectRss(source: RssSource): Promise<Item[]> {
  const feed = await parser.parseURL(source.url);
  return (feed.items || []).map((item) => ({
    id: `${source.id}-${slugify(item.link || item.title || "item")}`,
    source: source.id,
    title: item.title || "(untitled)",
    url: item.link || "",
    content: item.contentSnippet || item.content || "",
    tags: source.tags || [],
    capturedAt: item.isoDate || item.pubDate || new Date().toISOString(),
  }));
}

async function collectGithub(source: GithubSource): Promise<Item[]> {
  const [owner, repo] = source.repo.split("/");
  const events = await octokit.activity.listRepoEvents({ owner, repo, per_page: source.limit || 10 });
  const allowed = source.filters?.events?.map((e) => e.toLowerCase()) || [];
  return events.data
    .filter((event) => (allowed.length ? allowed.includes(event.type.replace("Event", "").toLowerCase()) : true))
    .map((event) => {
      let title = `${event.type}`;
      let content = "";
      let url = event.repo?.name ? `https://github.com/${event.repo.name}` : "";
      if (event.type === "PushEvent" && event.payload?.commits?.length) {
        const commit = event.payload.commits[event.payload.commits.length - 1];
        title = commit.message.split("\n")[0];
        url = commit.url?.replace("api.github.com/repos", "github.com").replace("commits", "commit") || url;
        content = `Pushed by ${commit.author?.name || event.actor?.login}`;
      } else if (event.type === "ReleaseEvent" && event.payload?.release) {
        const release = event.payload.release;
        title = release.name || release.tag_name || "Release";
        url = release.html_url || url;
        content = release.body || "";
      }
      return {
        id: `${source.id}-${event.id}`,
        source: source.id,
        title,
        url,
        content,
        tags: source.tags || [],
        capturedAt: event.created_at || new Date().toISOString(),
      } as Item;
    });
}

async function collectDiscord(source: DiscordSource): Promise<Item[]> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn(`DISCORD_BOT_TOKEN missing, skip ${source.id}`);
    return [];
  }
  const url = `https://discord.com/api/v10/channels/${source.channelId}/messages?limit=${source.limit || 20}`;
  const res = await fetch(url, { headers: { Authorization: `Bot ${token}` } });
  if (!res.ok) {
    throw new Error(`Discord API error ${res.status} for ${source.id}`);
  }
  const messages: any[] = await res.json();
  const guildId = source.guildId || process.env.DISCORD_GUILD_ID || "server";
  return messages.map((msg) => ({
    id: `${source.id}-${msg.id}`,
    source: source.id,
    title: (msg.content || "").split("\n")[0]?.slice(0, 120) || "(no title)",
    url: `https://discord.com/channels/${guildId}/${source.channelId}/${msg.id}`,
    content: msg.content || "",
    tags: source.tags || [],
    capturedAt: msg.timestamp,
  }));
}

async function collectSource(source: Source): Promise<Item[]> {
  switch (source.type) {
    case "rss":
      return collectRss(source);
    case "github":
      return collectGithub(source);
    case "discord":
      return collectDiscord(source);
    default:
      console.warn(`Unknown source type: ${source.type}`);
      return [];
  }
}

async function main() {
  const dateArg = process.argv[2];
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateSlug = dateArg || `${y}${m}${d}`;

  const config = await fs.readFile(FEEDS_PATH, "utf-8");
  const parsed: FeedConfig = JSON.parse(config);

  const allItems: Item[] = [];
  for (const source of parsed.sources) {
    try {
      const items = await collectSource(source);
      allItems.push(...items);
      console.log(`Fetched ${items.length} from ${source.id}`);
    } catch (err) {
      console.error(`Failed to fetch ${source.id}:`, err);
    }
  }

  allItems.sort((a, b) => (a.capturedAt > b.capturedAt ? -1 : 1));
  await fs.mkdir(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, `${dateSlug}.json`);
  await fs.writeFile(outPath, JSON.stringify(allItems, null, 2));
  console.log(`Saved ${allItems.length} items to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
