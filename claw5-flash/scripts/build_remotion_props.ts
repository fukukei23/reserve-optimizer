import { promises as fs } from "fs";
import path from "path";

const DRAFT_PATH = path.resolve("reviews", "daily-flash-draft.json");
const PROPS_PATH = path.resolve("remotion", "src", "props.json");

type Draft = {
  hook_line: string;
  headline1: { title: string; impact: string };
  headline2: { title: string; impact: string };
  headline3: { title: string; impact: string };
  action: { tip: string };
  closing: { shorts_cta: string; main_cta: string };
};

async function main() {
  const raw = await fs.readFile(DRAFT_PATH, "utf-8");
  const draft: Draft = JSON.parse(raw);

  const props = {
    hook: draft.hook_line,
    headlines: [
      { title: draft.headline1.title, impact: draft.headline1.impact },
      { title: draft.headline2.title, impact: draft.headline2.impact },
      { title: draft.headline3.title, impact: draft.headline3.impact },
    ],
    action: draft.action.tip,
    shortsCta: draft.closing.shorts_cta,
    mainCta: draft.closing.main_cta,
  };

  await fs.writeFile(PROPS_PATH, JSON.stringify(props, null, 2));
  console.log(`Remotion props written: ${PROPS_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
