#!/usr/bin/env python3
"""Upload image to existing rich menu and set as default (using requests)."""
import json, urllib.request, urllib.parse, os
import requests

HOME = os.path.expanduser('~')
WEBAPP_URL = os.environ.get('GAS_WEBAPP_URL', 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec')

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
gas_result = resp.json()
line_token = gas_result.get('result')
print(f"LINE Token: {line_token[:20]}...")

# 3. The rich menu was already created
rich_menu_id = os.environ.get('LINE_RICH_MENU_ID', 'YOUR_RICH_MENU_ID')

# 4. Upload image
image_path = os.environ.get('RICH_MENU_IMAGE_PATH', 'rich_menu.png')
with open(image_path, 'rb') as f:
    image_data = f.read()
print(f"Image size: {len(image_data)} bytes")

upload_url = f'https://api.line.me/v2/bot/richmenu/{rich_menu_id}/content'
resp = requests.post(upload_url, headers={
    'Authorization': f'Bearer {line_token}',
    'Content-Type': 'image/png'
}, data=image_data)
print(f"Upload: {resp.status_code} {resp.text[:200]}")

if resp.status_code != 200:
    print("Upload failed!")
    exit(1)

# 5. Set as default
set_url = f'https://api.line.me/v2/bot/user/all/richmenu/{rich_menu_id}'
resp = requests.post(set_url, headers={'Authorization': f'Bearer {line_token}'})
print(f"Set default: {resp.status_code} {resp.text[:200]}")

if resp.status_code == 200:
    print(f"\n✅ Rich menu setup complete! ID: {rich_menu_id}")
else:
    print(f"\n❌ Set default failed: {resp.status_code}")
