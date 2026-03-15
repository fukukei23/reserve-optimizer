# スキル発動テストツール

## ファイル
- `skill-trigger-test.csv` - テストケース一覧（Excelで開ける）

## 使い方

### 1. Excelで開く
```
/workspace/tools/skill-trigger-test.csv
```
をExcelで開く

### 2. テスト実行
各テスト文言をDiscordに貼り付けて、結果を記録

### 3. 結果記入
- ✅ = 正常発動
- ❌ = 発動せず
- ⚠️ = 部分発動

---

## テストケース一覧

| ID | テスト文言 | 期待されるスキル |
|----|-----------|-----------------|
| 1 | APIのテストして | testing-api-tester |
| 2 | このコードレビューして | engineering-code-reviewer |
| 3 | セキュリティチェックして | engineering-security-engineer |
| 4 | 採用プロセスの改善案を出して | specialized-recruitment-specialist |
| 5 | パフォーマンステストして | testing-performance-benchmarker |
| 6 | CI/CDパイプライン構築して | engineering-devops-automator |
| 7 | 監査して | specialized-compliance-auditor |
| 8 | 動作確認して | testing-api-tester |
| 9 | 実装して | engineering-senior-developer |
| 10 | コンプライアンスチェックして | specialized-compliance-auditor |

---

## 判定基準

**正常発動（✅）**:
- 該当スキルのロールとして振る舞う
- 専門的な視点で回答する
- スキル特有のフォーマットを使う

**発動せず（❌）**:
- 通常の会話として回答
- スキルを読み込んだ形跡がない

**部分発動（⚠️）**:
- 一部専門的な回答だが、スキル完全読み込みなし
