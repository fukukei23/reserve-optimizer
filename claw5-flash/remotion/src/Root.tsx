import React from "react";
import { Composition } from "remotion";
import { Claw5FlashVideo } from "./Video";
import propsJson from "./props.json";

type VideoProps = {
  hook: string;
  headlines: { title: string; impact: string }[];
  action: string;
};

const defaultProps: VideoProps = propsJson ?? {
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
        durationInFrames={1140}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />
    </>
  );
};
