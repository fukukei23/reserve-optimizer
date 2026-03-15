# Claw5 Flash TTS Style Guide

## 音声プロファイル
- **Voice**: Alto (落ち着き/少し低め)。例: ElevenLabs "Nova"、Azure "Aria"。
- **Speed**: 1.05x（Shortsは1.10x）。
- **Pitch**: -2 semitonesでニュース的落ち着き。
- **Energy**: Hook/CTAのみ +3% ボリューム。

## SSMLテンプレ
```xml
<speak>
  <prosody rate="1.05" pitch="-2st">
    <p>
      <emphasis level="moderate">{{hook_line}}</emphasis>
      <break time="0.25s"/>
    </p>
    <p>
      OpenClaw/AI自動化の最新を5分で届ける Claw5 Flash。
    </p>
    {{body_blocks}}
    <p>
      <prosody volume="+3dB">{{cta}}</prosody>
    </p>
  </prosody>
</speak>
```
- セクション間に `<break time="0.2s"/>` を必ず挿入。
- 数字は `<say-as interpret-as="cardinal">`。

## 録音メモ
- ノイズフロア -50dB以下。
- マスターは -16 LUFS / True Peak -1dB。
- Compressor: Ratio 3:1, Attack 5ms, Release 50ms。
- BGMとのミックスはSidechain -6dB。
