import { promises as fs } from "fs";
import path from "path";
import Mustache from "mustache";

type FlashDraft = any;

const REVIEW_DIR = path.resolve("claw5-flash", "reviews");
const TEMPLATE_FILE = path.resolve("claw5-flash", "templates", "postlog_v1.md");
const JSON_DRAFT = path.resolve(REVIEW_DIR, "daily-flash-draft.json");

async function main() {
  const template = await fs.readFile(TEMPLATE_FILE, "utf-8");
  const draftRaw = await fs.readFile(JSON_DRAFT, "utf-8");
  const draft: FlashDraft = JSON.parse(draftRaw);

  // 公開URLは後で埋める前提（空で出す）
  const view = {
    episode: process.argv[2] ?? "001",
    youtube_url: "{{youtube_url}}",
    shorts_url: "{{shorts_url}}",
    h1: { title: draft.headline1.title, impact: draft.headline1.impact, summary: draft.headline1.summary, url: draft.headline1.links?.[0] },
    h2: { title: draft.headline2.title, impact: draft.headline2.impact, summary: draft.headline2.summary, url: draft.headline2.links?.[0] },
    h3: { title: draft.headline3.title, impact: draft.headline3.impact, summary: draft.headline3.summary, url: draft.headline3.links?.[0] },
    script_path: "claw5-flash/reviews/daily-flash-YYYY-MM-DD.md",
    captions_path: "claw5-flash/reviews/shorts-YYYYMMDD.srt",
  };

  const out = Mustache.render(template, view);
  const outPath = path.join(REVIEW_DIR, `postlog-${view.episode}.md`);
  await fs.writeFile(outPath, out);
  console.log(`Postlog written: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
