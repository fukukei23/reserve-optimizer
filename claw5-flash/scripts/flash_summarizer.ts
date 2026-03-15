import { promises as fs } from "fs";
import path from "path";

export type SourceItem = {
  id: string;
  source: "zenn" | "github" | "discord" | "x" | "manual";
  title: string;
  url: string;
  content: string;
  tags?: string[];
  capturedAt: string;
};

export type HeadlineDraft = {
  title: string;
  summary: string;
  detail: string;
  impact: string;
  links: string[];
};

export type DeepDiveDraft = {
  title: string;
  context: string;
  mechanism: string;
  actions: string;
  links: string[];
};

export type FlashDraft = {
  generatedAt: string;
  hook_line: string;
  headline_titles_joined: string;
  headline1: HeadlineDraft;
  headline2: HeadlineDraft;
  headline3: HeadlineDraft;
  deepdive: DeepDiveDraft;
  action: { tip: string; resources: string; };
  closing: { teaser: string; shorts_cta: string; main_cta: string; };
};

const DATA_DIR = path.resolve("data");
const OUTPUT_PATH = path.resolve("reviews", "daily-flash-draft.json");

type LlmHeadline = {
  summary: string;
  detail: string;
  impact: string;
  action: string;
};

export async function buildDraft(dateSlug: string): Promise<void> {
  const sourcePath = path.join(DATA_DIR, `${dateSlug}.json`);
  const raw = await fs.readFile(sourcePath, "utf-8");
  const sources: SourceItem[] = JSON.parse(raw);

  if (sources.length < 3) {
    throw new Error("Need at least 3 sources for headlines");
  }

  const top3 = sources.slice(0, 3);
  const headline_titles_joined = top3.map((s) => s.title).join(" / ");

  const hook = buildHook(top3);
  const llmResults = await Promise.all(top3.map((item) => summarizeWithLLM(item)));

  const flashDraft: FlashDraft = {
    generatedAt: new Date().toISOString(),
    hook_line: hook,
    headline_titles_joined,
    headline1: toHeadline(top3[0], llmResults[0]),
    headline2: toHeadline(top3[1], llmResults[1]),
    headline3: toHeadline(top3[2], llmResults[2]),
    deepdive: buildDeepDive(top3),
    action: llmResults[0]?.action
      ? { tip: llmResults[0].action, resources: top3[0].url }
      : buildAction(top3[0]),
    closing: {
      teaser: "次回はUse Case Sprintで職種別テンプレを深掘り",
      shorts_cta: "Shortsで超要約版をチェック",
      main_cta: "チャンネル登録で毎朝5分の自動化ニュースを受け取ろう",
    },
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(flashDraft, null, 2));
  console.log(`Draft written to ${OUTPUT_PATH}`);
}

function sliceSentences(text: string, limit = 160): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}…`;
}

function toHeadline(item: SourceItem, llm?: LlmHeadline | null): HeadlineDraft {
  const baseSummary = llm?.summary ?? sliceSentences(item.content);
  const detail = llm?.detail ?? buildDetail(item);
  const impact = llm?.impact ?? buildImpact(item);

  return {
    title: item.title,
    summary: baseSummary,
    detail,
    impact,
    links: [item.url],
  };
}

function buildDetail(item: SourceItem): string {
  if (item.source === "github") {
    return "リポジトリ更新で新しいコマンド/設定が追加";
  }
  if (item.source === "discord") {
    return "コミュニティのリリースノートで正式告知";
  }
  if (item.source === "zenn") {
    return "ブログ/記事として実装手順が解説";
  }
  return "最新メモ";
}

function buildImpact(item: SourceItem): string {
  const tags = item.tags ?? [];
  if (tags.includes("cron")) {
    return "リマインダーや定期タスクの遅延を減らせる";
  }
  if (tags.includes("skills")) {
    return "スキルの再利用や配布が簡単になる";
  }
  if (tags.includes("digest")) {
    return "コンテンツ制作の時間を短縮";
  }
  return "ワークフロー全体に影響";
}

function buildHook(items: SourceItem[]): string {
  const first = items[0];
  const tag = first.tags?.[0] ?? first.source;
  return `今日のOpenClawは${tag}アップデートからスタート。5分で押さえよう。`;
}

function buildDeepDive(items: SourceItem[]): DeepDiveDraft {
  const links = items.map((s) => s.url);
  return {
    title: "Claw5 Flashパイプラインを公開",
    context: "長尺セミナーを追えない人向けに要約を自動生成したい",
    mechanism: "Cronでネタ収集→要約スクリプトで台本化→CapCut/TTSテンプレで整形",
    actions: "リポジトリをForkしてフィードとテンプレだけ差し替えれば自分用Digestが作れる",
    links,
  };
}

function buildAction(source: SourceItem) {
  if (source.tags?.includes("cron")) {
    return {
      tip: "Wake-Nowモードを1つのジョブで試す",
      resources: "docs/openclaw/cron と Clawhubのサンプル",
    };
  }
  if (source.tags?.includes("skills")) {
    return {
      tip: "Skill Packagerで社内テンプレを共有",
      resources: "clawhub.com/skills",
    };
  }
  return {
    tip: "DigestテンプレをForkしてみる",
    resources: "clawhub.com/templates/digest-pipeline",
  };
}

type LLMClient = {
  client: any;
  model: string;
  label: string;
};

let cachedLLMs: LLMClient[] | null = null;

async function getLLMClients(): Promise<LLMClient[]> {
  if (cachedLLMs) return cachedLLMs;
  const { default: OpenAI } = await import("openai");
  const clients: LLMClient[] = [];

  if (process.env.GLM_API_KEY) {
    clients.push({
      client: new OpenAI({
        apiKey: process.env.GLM_API_KEY,
        baseURL: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
      }),
      model: process.env.GLM_MODEL ?? "glm-5",
      label: "GLM",
    });
  }

  if (process.env.OPENAI_API_KEY) {
    clients.push({
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      label: "OpenAI",
    });
  }

  cachedLLMs = clients;
  return clients;
}

async function summarizeWithLLM(item: SourceItem): Promise<LlmHeadline | null> {
  const clients = await getLLMClients();
  if (!clients.length) return null;

  const prompt = `You are generating headline summary text for automation news. Respond in Japanese JSON with keys summary, detail, impact, action. Content:\n${item.content}`;

  for (const llm of clients) {
    try {
      const response = await llm.client.chat.completions.create({
        model: llm.model,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.choices[0]?.message?.content ?? "";
      const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      return parsed as LlmHeadline;
    } catch (err) {
      console.warn(`${llm.label} summarization failed`, err);
      continue;
    }
  }

  return null;
}

if (process.argv[1]?.endsWith("flash_summarizer.ts")) {
  const dateSlug = process.argv[2];
  if (!dateSlug) {
    console.error("Usage: ts-node flash_summarizer.ts YYYYMMDD");
    process.exit(1);
  }

  buildDraft(dateSlug).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
