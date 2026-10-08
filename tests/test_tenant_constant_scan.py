# tests/test_tenant_constant_scan.py
"""tenant_constant_scan.py の単体テスト（リポジトリルートで pytest 実行）"""
from scripts.tenant_constant_scan import scan_file, write_tsv

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
