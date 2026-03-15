import { promises as fs } from "fs";
import path from "path";
import Mustache from "mustache";

const REVIEW_DIR = path.resolve("reviews");
const TEMPLATE_FILE = path.resolve("templates", "flash_v1.md");
const JSON_DRAFT = path.resolve(REVIEW_DIR, "daily-flash-draft.json");

async function main() {
  const template = await fs.readFile(TEMPLATE_FILE, "utf-8");
  const draftRaw = await fs.readFile(JSON_DRAFT, "utf-8");
  const data = JSON.parse(draftRaw);

  const rendered = Mustache.render(template, data);
  const outPath = path.join(REVIEW_DIR, `daily-flash-${data.generatedAt.slice(0, 10)}.md`);

  await fs.writeFile(outPath, rendered);
  console.log(`Rendered ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
