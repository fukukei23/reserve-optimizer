import React from "react";
import { Composition } from "remotion";
import { Claw5FlashVideo } from "./Video";
import * as fs from "fs";
import * as path from "path";

const PROPS_FILE = path.join(__dirname, "props.json");

const defaultProps = fs.existsSync(PROPS_FILE)
  ? JSON.parse(fs.readFileSync(PROPS_FILE, "utf-8"))
  : {
      hook: "今日のOpenClawはcronアップデートからスタート。5分で押さえよう。",
      headlines: [
        { title: "Cron Wake-Now", impact: "リマインダー遅延ゼロ" },
        { title: "Skills Packager", impact: "社内テンプレ共有が簡単に" },
        { title: "Digest Pipeline", impact: "5分動画の自動化が可能に" },
      ],
      action: "Wake-Nowを1ジョブで試す",
    };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Claw5Flash"
        component={Claw5FlashVideo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
      />
    </>
  );
};
