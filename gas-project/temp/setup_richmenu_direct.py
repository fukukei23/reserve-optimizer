#!/usr/bin/env python3
"""Setup LINE Rich Menu directly via LINE API (no GAS for image upload)."""
import json, urllib.request, urllib.parse, os, base64

HOME = os.path.expanduser('~')

# 1. Get LINE token from ScriptProperties via Web App
WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwWSnmX2HqMwM2xz1ilCgqjG05TQHmg0o4jTNThKHXCI9QpfBEzm8qsWErCOmU6gI6K/exec'

# Get OAuth token for GAS
with open(os.path.join(HOME, '.clasprc.json')) as f:
    t = json.load(f)['tokens']['default']
data = urllib.parse.urlencode({
    'client_id': t['client_id'], 'client_secret': t['client_secret'],
    'refresh_token': t['refresh_token'], 'grant_type': 'refresh_token'
}).encode()
r = json.loads(urllib.request.urlopen(urllib.request.Request(
    'https://oauth2.googleapis.com/token', data=data)).read())
token = r['access_token']
print("OAuth Token OK")

import http.cookiejar
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def call_gas(fn):
    url = f'{WEBAPP_URL}?fn={fn}'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    resp = opener.open(req, timeout=60)
    return json.loads(resp.read().decode())

# Get LINE access token via GAS
r = call_gas('testConfig')
print(f"GAS config check: LINE token={'SET' if r.get('result', {}).get('lineChannelAccessToken') == 'SET' else 'NOT_SET'}")

# Actually we need the LINE token directly. Read it from .env or use the GAS approach.
# Let's just get the rich menu ID that was created and upload directly.
# First, check if there are orphaned rich menus

# 2. Get LINE channel access token from a dedicated GAS function
# We need a way to get the LINE token. Let's use a test function that returns it.
# Actually testConfig only returns SET/NOT_SET. Let's get it differently.
# Read from .env file if available, or from ScriptProperties.

# Try reading from local env
line_token = None
env_path = os.path.join(HOME, 'projects/reserve-optimizer/gas-project/.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.startswith('LINE_CHANNEL_ACCESS_TOKEN='):
                line_token = line.strip().split('=', 1)[1]
                break

if not line_token:
    print("LINE token not in .env, fetching from GAS...")
    r = call_gas('getLineAccessToken')
    line_token = r.get('result')
    if not line_token:
        print("ERROR: Could not get LINE token from GAS")
        exit(1)

print(f"LINE Token: {line_token[:20]}...")

# 3. List existing rich menus
print("\n--- Listing existing rich menus ---")
list_url = 'https://api.line.me/v2/bot/richmenu/list'
req = urllib.request.Request(list_url, headers={'Authorization': f'Bearer {line_token}'})
resp = urllib.request.urlopen(req)
menus = json.loads(resp.read())
print(f"Existing menus: {json.dumps(menus, indent=2)[:500]}")

# 4. Delete existing default rich menu
print("\n--- Checking default rich menu ---")
default_url = 'https://api.line.me/v2/bot/user/all/richmenu'
req = urllib.request.Request(default_url, headers={'Authorization': f'Bearer {line_token}'})
try:
    resp = urllib.request.urlopen(req)
    default = json.loads(resp.read())
    old_id = default.get('richMenuId')
    if old_id:
        print(f"Old default: {old_id}, removing...")
        # Unset default
        del_default_url = f'https://api.line.me/v2/bot/user/all/richmenu/{old_id}'
        del_req = urllib.request.Request(del_default_url, method='DELETE',
                                         headers={'Authorization': f'Bearer {line_token}'})
        urllib.request.urlopen(del_req)
        # Delete menu
        del_menu_url = f'https://api.line.me/v2/bot/richmenu/{old_id}'
        del_req2 = urllib.request.Request(del_menu_url, method='DELETE',
                                          headers={'Authorization': f'Bearer {line_token}'})
        urllib.request.urlopen(del_req2)
        print(f"Deleted old menu: {old_id}")
except urllib.error.HTTPError as e:
    print(f"No default set (or error): {e.code}")

# 5. Create new rich menu
print("\n--- Creating rich menu ---")
create_payload = {
    "size": {"width": 2500, "height": 1686},
    "selected": False,
    "name": "reserve-bot-menu",
    "chatBarText": "メニュー",
    "areas": [
        {
            "bounds": {"x": 0, "y": 0, "width": 1250, "height": 843},
            "action": {"type": "message", "text": "予約する"}
        },
        {
            "bounds": {"x": 1250, "y": 0, "width": 1250, "height": 843},
            "action": {"type": "message", "text": "予約変更・キャンセル"}
        },
        {
            "bounds": {"x": 0, "y": 843, "width": 1250, "height": 843},
            "action": {"type": "message", "text": "営業時間・アクセス"}
        },
        {
            "bounds": {"x": 1250, "y": 843, "width": 1250, "height": 843},
            "action": {"type": "message", "text": "お問い合わせ"}
        }
    ]
}
create_req = urllib.request.Request(
    'https://api.line.me/v2/bot/richmenu',
    data=json.dumps(create_payload).encode(),
    headers={
        'Authorization': f'Bearer {line_token}',
        'Content-Type': 'application/json'
    }
)
resp = urllib.request.urlopen(create_req)
create_result = json.loads(resp.read())
rich_menu_id = create_result['richMenuId']
print(f"Created rich menu: {rich_menu_id}")

# 6. Upload image
print("\n--- Uploading image ---")
image_path = '/mnt/c/Users/USER/workspace/active/line_rich_menu.png'
with open(image_path, 'rb') as f:
    image_data = f.read()
print(f"Image size: {len(image_data)} bytes")

upload_url = f'https://api.line.me/v2/bot/richmenu/{rich_menu_id}/content'
upload_req = urllib.request.Request(
    upload_url,
    data=image_data,
    headers={
        'Authorization': f'Bearer {line_token}',
        'Content-Type': 'image/png'
    }
)
resp = urllib.request.urlopen(upload_req)
print(f"Upload response: {resp.status}")

# 7. Set as default
print("\n--- Setting as default ---")
set_default_url = f'https://api.line.me/v2/bot/user/all/richmenu/{rich_menu_id}'
set_req = urllib.request.Request(set_default_url, method='POST',
                                  headers={'Authorization': f'Bearer {line_token}'})
resp = urllib.request.urlopen(set_req)
print(f"Set default response: {resp.status}")

print(f"\n✅ Rich menu setup complete! ID: {rich_menu_id}")
