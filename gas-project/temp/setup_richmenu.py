#!/usr/bin/env python3
"""Upload rich menu image to Drive and setup LINE Rich Menu."""
import json, urllib.request, urllib.parse, os, sys

HOME = os.path.expanduser('~')

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
print(f"Token OK ({len(token)} chars)")

# 2. Upload image to Google Drive
print("Uploading image to Drive...")
with open('/mnt/c/Users/USER/workspace/active/line_rich_menu.png', 'rb') as f:
    image_data = f.read()
print(f"Image size: {len(image_data)} bytes")

boundary = 'BOUNDARY123456'
metadata = json.dumps({'name': 'line_rich_menu.png', 'mimeType': 'image/png'})
body = (
    f'--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}'
    f'\r\n--{boundary}\r\nContent-Type: image/png\r\n\r\n'
).encode() + image_data + f'\r\n--{boundary}--\r\n'.encode()

req = urllib.request.Request(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    data=body,
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': f'multipart/related; boundary={boundary}'
    }
)
resp = urllib.request.urlopen(req)
result = json.loads(resp.read())
file_id = result['id']
print(f"Drive file ID: {file_id}")

# 3. Call GAS setupRichMenuWithDriveId via Web App
print("Calling setupRichMenuWithDriveId...")
webapp_url = 'https://script.google.com/macros/s/AKfycbwWSnmX2HqMwM2xz1ilCgqjG05TQHmg0o4jTNThKHXCI9QpfBEzm8qsWErCOmU6gI6K/exec'
setup_url = f'{webapp_url}?fn=setupRichMenuWithDriveId&p1={file_id}'
req2 = urllib.request.Request(setup_url, headers={'Authorization': f'Bearer {token}'})
resp2 = urllib.request.urlopen(req2)
result2 = json.loads(resp2.read().decode())
print(f"Result: {json.dumps(result2, indent=2, ensure_ascii=False)}")

# 4. Also update production deployment
print("\nUpdating production deployment to v60...")
script_id = '1pIrvLcTTUPvAZtQ88QDgrhVMp2QBPxw486Gbcd_TaJp7u2gYfWHQMFXk'
prod_deploy_id = 'AKfycbzz1R3Eb6bSONHHo1a5zPWydDA0XBkNHVHy4x4osRzttTQpPUKLe9stIDHNDYtfg3Rz'
deploy_url = f'https://script.googleapis.com/v1/projects/{script_id}/deployments/{prod_deploy_id}'
deploy_body = json.dumps({
    'deploymentConfig': {
        'versionNumber': 60,
        'description': 'v60: setupRichMenuWithDriveId'
    }
}).encode()
req3 = urllib.request.Request(deploy_url, data=deploy_body, headers={
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
})
req3.method = 'PUT'
resp3 = urllib.request.urlopen(req3)
deploy_result = json.loads(resp3.read())
print(f"Production updated: v60")
