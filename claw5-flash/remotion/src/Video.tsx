import React from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig, spring, interpolate, Sequence } from "remotion";
import { registerFont } from "canvas";
import notoFontPath from "./fonts/NotoSansJP-Regular.otf";

// Node.js環境でフォントを登録
try {
  registerFont(notoFontPath, { family: "Noto Sans JP" });
  console.log("Noto Sans JP registered for canvas/Remotion");
} catch (e) {
  console.warn("registerFont failed (canvas may be unavailable):", e);
}

export const Claw5FlashVideo: React.FC<{
  hook: string;
  headlines: { title: string; impact: string }[];
  action: string;
}> = ({ hook, headlines, action }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg = interpolateColors(frame, [0, fps * 35], ["#0B1220", "#1F1F3A"]);

  // フックのアニメーション
  const hookOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const hookY = interpolate(frame, [0, 15], [-50, 0], { extrapolateRight: "clamp" });

  // アクションのアニメーション
  const actionOpacity = interpolate(frame, [fps * 30, fps * 33], [0, 1], { extrapolateRight: "clamp" });
  const actionScale = spring({ frame, fps, config: { damping: 10, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ backgroundColor: bg, padding: 80, color: "white", fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* Hook */}
      <div style={{
        fontSize: 48,
        fontWeight: 700,
        marginBottom: 40,
        opacity: hookOpacity,
        transform: `translateY(${hookY}px)`,
      }}>
        {hook}
      </div>

      {/* Headlines */}
      <div style={{ display: "grid", gap: 24 }}>
        {headlines.map((h, idx) => {
          const delay = idx * 10 + 20;
          const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateRight: "clamp" });
          const x = interpolate(frame, [delay, delay + 10], [-30, 0], { extrapolateRight: "clamp" });

          return (
            <div key={h.title} style={{
              borderLeft: "6px solid #FF3FA4",
              paddingLeft: 20,
              opacity,
              transform: `translateX(${x}px)`,
            }}>
              <div style={{ fontSize: 32, fontWeight: 600 }}>{idx + 1}. {h.title}</div>
            </div>
          );
        })}
      </div>

      {/* Action */}
      <div style={{
        position: "absolute",
        bottom: 60,
        fontSize: 28,
        fontWeight: 600,
        opacity: actionOpacity,
        transform: `scale(${actionScale})`,
      }}>
        ✅ {action}
      </div>
    </AbsoluteFill>
  );
};
