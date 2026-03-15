import { google } from "googleapis";
import { promises as fs } from "fs";
import { createReadStream } from "fs";
import path from "path";
import readline from "readline";

const CONFIG_DIR = path.resolve("config");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "youtube.credentials.json");
const TOKEN_PATH = path.join(CONFIG_DIR, "youtube.token.json");
const DRAFT_PATH = path.resolve("reviews", "daily-flash-draft.json");

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function saveJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function getOAuthClient() {
  const credentials = await readJson<any>(CREDENTIALS_PATH);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  try {
    const token = await readJson<any>(TOKEN_PATH);
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  } catch {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/youtube.upload"],
      prompt: "consent",
    });
    console.log("Authorize this app by visiting this url:", authUrl);
    const code = await askQuestion("Enter the code from that page: ");
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    await saveJson(TOKEN_PATH, tokens);
    console.log(`Token stored to ${TOKEN_PATH}`);
    return oAuth2Client;
  }
}

type Draft = {
  hook_line: string;
  headline1: { title: string; summary: string; links?: string[] };
  headline2: { title: string; summary: string; links?: string[] };
  headline3: { title: string; summary: string; links?: string[] };
  action: { tip: string; resources?: string };
};

function buildDescription(draft: Draft) {
  const lines = [
    draft.hook_line,
    "",
    "【Headlines】",
    `1) ${draft.headline1.title} - ${draft.headline1.summary}`,
    `2) ${draft.headline2.title} - ${draft.headline2.summary}`,
    `3) ${draft.headline3.title} - ${draft.headline3.summary}`,
    "",
    "【Action】",
    draft.action.tip,
  ];
  if (draft.action.resources) {
    lines.push("参考リンク:", draft.action.resources);
  }
  return lines.join("\n");
}

async function main() {
  const dateSlug = process.argv[2];
  if (!dateSlug) {
    console.error("Usage: npm run publish -- YYYYMMDD [2026-03-10T09:00:00+09:00]");
    process.exit(1);
  }
  const publishAtArg = process.argv[3];
  const presetVideo = process.env.YOUTUBE_VIDEO_PATH || path.resolve("out", `main-${dateSlug}.mp4`);
  const videoPath = publishAtArg && publishAtArg.endsWith(".mp4") ? publishAtArg : presetVideo;
  const scheduledAt = publishAtArg && !publishAtArg.endsWith(".mp4") ? new Date(publishAtArg) : null;

  try {
    await fs.access(videoPath);
  } catch {
    console.error(`Video file not found: ${videoPath}`);
    process.exit(1);
  }

  const draft = await readJson<Draft>(DRAFT_PATH);
  const title = `Claw5 Flash ${dateSlug} - ${draft.headline1.title}`;
  const description = buildDescription(draft);

  const auth = await getOAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const privacyStatus = process.env.YOUTUBE_PRIVACY ?? (scheduledAt ? "private" : "unlisted");

  const requestBody = {
    snippet: {
      title,
      description,
      tags: ["OpenClaw", "Automation", "Claw5 Flash"],
      defaultLanguage: "ja",
    },
    status: {
      privacyStatus,
      publishAt: scheduledAt ? scheduledAt.toISOString() : undefined,
      selfDeclaredMadeForKids: false,
    },
  };

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody,
    media: {
      body: createReadStream(videoPath),
    },
  } as any);

  console.log("Uploaded video:", res.data.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
