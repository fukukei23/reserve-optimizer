# 中央死活外部プローブ設定手順
（spec §4 C1・「中央が死んで誰が気づくか」対策）

## 手順

1. UptimeRobot（無料枠50モニター）でアカウント作成:
   https://uptimerobot.com
2. Add New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: reserve-optimizer-central
   - URL: https://reserve-optimizer.fukukei44161.workers.dev/health
   - Monitoring Interval: 60分（無料枠の制約）
   - 「Send an email alert」に開発者メールアドレス
3. 1時間後にUptimeRobotダッシュボードで「Up」表示を確認
4. 検証: ターミナルから
   `curl -s https://reserve-optimizer.fukukei44161.workers.dev/health`
   が `{"status":"ok"...}` を返すことと一致することを確認

## 実機確認（2026-10-09実測）

```
$ curl -s https://reserve-optimizer.fukukei44161.workers.dev/health
{"status":"ok","gas_reachable":true,...}
```

## 注意

- 60分間隔のため「検知遅延3h以内」KPI（spec §9）の中央側要件は
  このプローブ+ハートビート欠落検知の組合せで満たす。
- プローブがDownになったら開発者が手動で復旧
  （spec §3 復旧権限=開発者）。
- **UptimeRobotアカウント登録自体は人間タスク**（コード化不可）。
  本runbookは設定手順の正典。
