#!/usr/bin/env python3
"""Complete rich menu setup: create → upload → set default, all via requests."""
import json, urllib.request, urllib.parse, os
import requests

HOME = os.path.expanduser('~')
WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwWSnmX2HqMwM2xz1ilCgqjG05TQHmg0o4jTNThKHXCI9QpfBEzm8qsWErCOmU6gI6K/exec'

# 1. Get OAuth token
with open(os.path.join(HOME, '.clasprc.json')) as f:
    t = json.load(f)['tokens']['default']
data = urllib.parse.urlencode({
    'client_id': t['client_id'], 'client_secret': t['client_secret'],
    'refresh_token': t['refresh_token'], 'grant_type': 'refresh_token'
}).encode()
r = json.loads(urllib.request.urlopen(urllib.request.Request(
    'https://oauth2.googleapis.com/token', data=data)).read())
token = r['access_token']

# 2. Get LINE token from GAS
resp = requests.get(f'{WEBAPP_URL}?fn=getLineAccessToken', headers={'Authorization': f'Bearer {token}'}, allow_redirects=True)
line_token = resp.json().get('result')
print(f"LINE Token OK: {line_token[:20]}...")

headers = {'Authorization': f'Bearer {line_token}'}

# 3. Delete old orphaned menus
print("\n--- Cleanup old menus ---")
resp = requests.get('https://api.line.me/v2/bot/richmenu/list', headers=headers)
menus = resp.json().get('richmenus', [])
for m in menus:
    mid = m['richMenuId']
    print(f"  Deleting: {mid}")
    requests.delete(f'https://api.line.me/v2/bot/richmenu/{mid}', headers=headers)

# Unset default
resp = requests.get('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
if resp.status_code == 200:
    old_default = resp.json().get('richMenuId')
    if old_default:
        print(f"  Unsetting old default: {old_default}")
        requests.delete(f'https://api.line.me/v2/bot/user/all/richmenu/{old_default}', headers=headers)

# 4. Create rich menu
print("\n--- Creating rich menu ---")
create_payload = {
    "size": {"width": 2500, "height": 1686},
    "selected": False,
    "name": "reserve-bot-menu",
    "chatBarText": "メニュー",
    "areas": [
        {"bounds": {"x": 0, "y": 0, "width": 1250, "height": 843}, "action": {"type": "message", "text": "予約する"}},
        {"bounds": {"x": 1250, "y": 0, "width": 1250, "height": 843}, "action": {"type": "message", "text": "予約変更・キャンセル"}},
        {"bounds": {"x": 0, "y": 843, "width": 1250, "height": 843}, "action": {"type": "message", "text": "営業時間・アクセス"}},
        {"bounds": {"x": 1250, "y": 843, "width": 1250, "height": 843}, "action": {"type": "message", "text": "お問い合わせ"}}
    ]
}
resp = requests.post('https://api.line.me/v2/bot/richmenu',
    headers={**headers, 'Content-Type': 'application/json'},
    data=json.dumps(create_payload))
print(f"  Create: {resp.status_code}")
if resp.status_code != 200:
    print(f"  Error: {resp.text}")
    exit(1)
rich_menu_id = resp.json()['richMenuId']
print(f"  ID: {rich_menu_id}")

# 5. Upload image
print("\n--- Uploading image ---")
image_path = '/mnt/c/Users/USER/workspace/active/line_rich_menu.png'
with open(image_path, 'rb') as f:
    image_data = f.read()
print(f"  Size: {len(image_data)} bytes")

resp = requests.post(f'https://api-data.line.me/v2/bot/richmenu/{rich_menu_id}/content',
    headers={**headers, 'Content-Type': 'image/png'},
    data=image_data)
print(f"  Upload: {resp.status_code}")
if resp.status_code != 200:
    print(f"  Error: {resp.text}")
    # Cleanup
    requests.delete(f'https://api.line.me/v2/bot/richmenu/{rich_menu_id}', headers=headers)
    exit(1)

# 6. Set as default
print("\n--- Setting as default ---")
resp = requests.post(f'https://api.line.me/v2/bot/user/all/richmenu/{rich_menu_id}', headers=headers)
print(f"  Set default: {resp.status_code}")

if resp.status_code == 200:
    print(f"\n✅ Rich menu setup complete!")
    print(f"  ID: {rich_menu_id}")
    print(f"  Layout: 2x2 (予約する | 予約変更・キャンセル | 営業時間・アクセス | お問い合わせ)")
else:
    print(f"\n❌ Set default failed: {resp.status_code} {resp.text}")
