import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.resolve("data");
const REVIEW_DIR = path.resolve("reviews");

export type ShortsInput = {
  date: string; // YYYYMMDD
  hook: string;
  points: string[];
  tip: string;
  resource: string;
  cta: string;
};

export type CaptionLine = {
  start: number;
  end: number;
  text: string;
  style: "accent" | "body" | "tip" | "resource" | "cta";
};

function chunkText(text: string, start: number, duration: number, style: CaptionLine["style"]): CaptionLine {
  return {
    start,
    end: start + duration,
    text,
    style,
  };
}

export async function buildShortsCaptions(slug: string): Promise<void> {
  const inputPath = path.join(DATA_DIR, `shorts-${slug}.json`);
  const raw = await fs.readFile(inputPath, "utf-8");
  const payload: ShortsInput = JSON.parse(raw);

  let cursor = 0;
  const lines: CaptionLine[] = [];
  lines.push(chunkText(payload.hook, cursor, 3, "accent"));
  cursor += 3;

  payload.points.forEach((point) => {
    lines.push(chunkText(point, cursor, 5, "body"));
    cursor += 5;
  });

  lines.push(chunkText(payload.tip, cursor, 8, "tip"));
  cursor += 8;

  lines.push(chunkText(payload.resource, cursor, 7, "resource"));
  cursor += 7;

  lines.push(chunkText(payload.cta, cursor, 5, "cta"));

  const baseName = `shorts-${payload.date}`;
  const jsonPath = path.join(REVIEW_DIR, `${baseName}-captions.json`);
  await fs.writeFile(jsonPath, JSON.stringify({ captions: lines }, null, 2));

  const srtPath = path.join(REVIEW_DIR, `${baseName}.srt`);
  await fs.writeFile(srtPath, toSrt(lines));

  const ttmlPath = path.join(REVIEW_DIR, `${baseName}.ttml`);
  await fs.writeFile(ttmlPath, toTtml(lines));

  console.log(`Shorts captions exported: ${jsonPath}, ${srtPath}, ${ttmlPath}`);
}

function toTimecode(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  const millis = Math.round((seconds % 1) * 1000)
    .toString()
    .padStart(3, "0");
  return `${hrs}:${mins}:${secs},${millis}`;
}

function toSrt(lines: CaptionLine[]): string {
  return lines
    .map((line, idx) => {
      return `${idx + 1}\n${toTimecode(line.start)} --> ${toTimecode(line.end)}\n${line.text}\n`;
    })
    .join("\n");
}

function toTtml(lines: CaptionLine[]): string {
  const body = lines
    .map((line, idx) => {
      return `  <p xml:id="p${idx + 1}" begin="${line.start}s" end="${line.end}s" style="${line.style}">${line.text}</p>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<tt xmlns="http://www.w3.org/ns/ttml">\n <body>\n${body}\n </body>\n</tt>\n`;
}

if (process.argv[1]?.endsWith("shorts_caption_builder.ts")) {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: ts-node shorts_caption_builder.ts YYYYMMDD");
    process.exit(1);
  }

  buildShortsCaptions(slug).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
