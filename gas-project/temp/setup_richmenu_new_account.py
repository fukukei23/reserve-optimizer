#!/usr/bin/env python3
"""Setup LINE Rich Menu directly via LINE API for new account."""
import json, urllib.request

LINE_TOKEN = 'YOUR_LINE_CHANNEL_ACCESS_TOKEN_HERE'  # Set from ScriptProperties or .env
IMAGE_PATH = '/mnt/c/Users/USER/workspace/active/line_rich_menu.png'
HEADERS = {'Authorization': f'Bearer {LINE_TOKEN}'}

def api(method, url, data=None, content_type='application/json'):
    headers = dict(HEADERS)
    if content_type:
        headers['Content-Type'] = content_type
    if isinstance(data, dict):
        data = json.dumps(data).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        body = resp.read()
        return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read()
        print(f"  HTTP {e.code}: {body.decode()[:200]}")
        return e.code, {}

# 1. List & delete existing menus
print("=== 1. Cleaning up existing rich menus ===")
status, menus = api('GET', 'https://api.line.me/v2/bot/richmenu/list')
for m in menus.get('richmenus', []):
    mid = m['richMenuId']
    print(f"  Deleting menu: {mid}")
    api('DELETE', f'https://api.line.me/v2/bot/richmenu/{mid}')

# 2. Create new rich menu
print("\n=== 2. Creating rich menu ===")
payload = {
    "size": {"width": 2500, "height": 1686},
    "selected": False,
    "name": "reserve-bot-menu",
    "chatBarText": "メニュー",
    "areas": [
        {"bounds": {"x": 0,    "y": 0,   "width": 1250, "height": 843},
         "action": {"type": "message", "text": "予約する"}},
        {"bounds": {"x": 1250, "y": 0,   "width": 1250, "height": 843},
         "action": {"type": "message", "text": "予約変更・キャンセル"}},
        {"bounds": {"x": 0,    "y": 843, "width": 1250, "height": 843},
         "action": {"type": "message", "text": "営業時間・アクセス"}},
        {"bounds": {"x": 1250, "y": 843, "width": 1250, "height": 843},
         "action": {"type": "message", "text": "お問い合わせ"}}
    ]
}
status, result = api('POST', 'https://api.line.me/v2/bot/richmenu', payload)
if status != 200:
    print("ERROR: Failed to create rich menu")
    exit(1)
rich_menu_id = result['richMenuId']
print(f"  Created: {rich_menu_id}")

# 3. Upload image
print("\n=== 3. Uploading image ===")
with open(IMAGE_PATH, 'rb') as f:
    image_data = f.read()
print(f"  Image size: {len(image_data):,} bytes")
status, _ = api('POST',
    f'https://api-data.line.me/v2/bot/richmenu/{rich_menu_id}/content',
    data=image_data, content_type='image/png')
print(f"  Upload status: {status}")
if status != 200:
    print("ERROR: Image upload failed")
    exit(1)

# 4. Set as default
print("\n=== 4. Setting as default ===")
status, _ = api('POST', f'https://api.line.me/v2/bot/user/all/richmenu/{rich_menu_id}')
print(f"  Set default status: {status}")

print(f"\n✅ Rich menu setup complete! ID: {rich_menu_id}")
