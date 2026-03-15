import React from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";

export const Claw5FlashVideo: React.FC<{
  hook: string;
  headlines: { title: string; impact: string }[];
  action: string;
}> = ({ hook, headlines, action }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg = interpolateColors(frame, [0, fps * 5], ["#0B1220", "#1F1F3A"]);

  return (
    <AbsoluteFill style={{ backgroundColor: bg, padding: 120, color: "white", fontFamily: "'Barlow', sans-serif" }}>
      <div style={{ fontSize: 64, fontWeight: 700 }}>{hook}</div>
      <div style={{ marginTop: 60, display: "grid", gap: 32 }}>
        {headlines.map((h, idx) => (
          <div key={h.title} style={{ borderLeft: "6px solid #FF3FA4", paddingLeft: 24 }}>
            <div style={{ fontSize: 38, fontWeight: 600 }}>{idx + 1}. {h.title}</div>
            <div style={{ fontSize: 28, opacity: 0.8 }}>{h.impact}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 80, fontSize: 32 }}>
        行動: {action}
      </div>
    </AbsoluteFill>
  );
};
