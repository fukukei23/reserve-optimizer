# tests/test_tenant_constant_scan.py
"""tenant_constant_scan.py の単体テスト（リポジトリルートで pytest 実行）"""
from scripts.tenant_constant_scan import scan_file, scan_repo, write_tsv

FIXTURE = """
var SHEET_ID = '1AbCdEfGhIjKlMnOpQrStUvWx12345'; // Sheet master
var CHANNEL_ID = 'U1234567890abcdef1234567890abcdef';
var BASE_URL = 'https://script.google.com/macros/s/AKfycbXYZ/exec';
var RETRY_MAX = 3; // 共通設定・テナント固有でない
"""

def test_scan_file_detects_sheet_id():
    findings = scan_file("gas-project/Code.js", FIXTURE)
    cats = [f["category"] for f in findings]
    assert "spreadsheet_id" in cats

def test_scan_file_detects_line_channel_id():
    findings = scan_file("gas-project/Code.js", FIXTURE)
    cats = [f["category"] for f in findings]
    assert "line_channel_id" in cats

def test_scan_file_detects_webapp_url():
    findings = scan_file("gas-project/Code.js", FIXTURE)
    cats = [f["category"] for f in findings]
    assert "gas_webapp_url" in cats

def test_scan_file_ignores_common_numbers():
    findings = scan_file("gas-project/Code.js", FIXTURE)
    cats = [f["category"] for f in findings]
    assert "common_number" not in cats  # RETRY_MAX=3 は摘出しない

def test_tsv_has_required_columns(tmp_path):
    findings = scan_file("gas-project/Code.js", FIXTURE)
    out = tmp_path / "out.tsv"
    write_tsv(findings, out)
    header = out.read_text().splitlines()[0]
    assert header == "category\tvalue\tfile\tline\tjudgment"

def test_tsv_row_contains_all_fields(tmp_path):
    findings = scan_file("gas-project/Code.js", FIXTURE)
    out = tmp_path / "out.tsv"
    write_tsv(findings, out)
    rows = out.read_text().splitlines()[1:]
    assert len(rows) == len(findings)
    first = rows[0].split("\t")
    assert len(first) == 5
    assert first[0] in ("spreadsheet_id", "line_channel_id",
                        "gas_webapp_url")
    assert first[1] != ""  # value[:40] が入る
    assert first[3] != ""  # 行番号が入る
    assert first[4] == ""  # judgment は空で出力

def test_scan_repo_walks_gas_project(tmp_path):
    gas = tmp_path / "gas-project"
    (gas / "tests").mkdir(parents=True)
    (gas / "Code.js").write_text(FIXTURE, encoding="utf-8")
    (gas / "tests" / "Skip.js").write_text(
        "var T = 'U" + "a" * 32 + "';", encoding="utf-8"
    )
    findings = scan_repo(tmp_path)
    files = [f["file"] for f in findings]
    assert all(f == "gas-project/Code.js" for f in files)
    assert findings, "Code.js から検出があること"

def test_scan_repo_skips_node_modules(tmp_path):
    gas = tmp_path / "gas-project"
    (gas / "node_modules" / "lib").mkdir(parents=True)
    (gas / "node_modules" / "lib" / "X.js").write_text(
        "var T = 'U" + "b" * 32 + "';", encoding="utf-8"
    )
    findings = scan_repo(tmp_path)
    assert findings == []

def test_main_writes_tsv(tmp_path, monkeypatch):
    gas = tmp_path / "gas-project"
    gas.mkdir()
    (gas / "Code.js").write_text(FIXTURE, encoding="utf-8")
    from scripts.tenant_constant_scan import main
    out = tmp_path / "docs" / "out.tsv"
    out.parent.mkdir()
    monkeypatch.setattr(
        "sys.argv",
        ["prog", "--repo", str(tmp_path), "--out", str(out)],
    )
    main()
    assert out.exists()
    assert out.read_text().startswith(
        "category\tvalue\tfile\tline\tjudgment"
    )
