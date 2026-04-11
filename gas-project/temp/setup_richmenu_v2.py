#!/usr/bin/env python3
"""Set ScriptProperties via Apps Script API, then run setupRichMenuFromProperty."""
import json, urllib.request, urllib.parse, os

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
print(f"Token OK")

# 2. Read base64 image
with open('/tmp/richmenu_b64.txt') as f:
    b64 = f.read().strip()
print(f"Base64 length: {len(b64)}")

# 3. Use Apps Script API to run setProperty
script_id = '1pIrvLcTTUPvAZtQ88QDgrhVMp2QBPxw486Gbcd_TaJp7u2gYfWHQMFXk'
exec_url = f'https://script.googleapis.com/v1/scripts/{script_id}:run'

body = json.dumps({
    'function': 'setProperty',
    'parameters': ['RICHMENU_IMAGE_B64', b64]
}).encode()

req = urllib.request.Request(exec_url, data=body, headers={
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
})

try:
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    print(f"setProperty result: {json.dumps(result, indent=2)[:500]}")
except urllib.error.HTTPError as e:
    error_body = e.read().decode()
    print(f"HTTP Error {e.code}: {error_body[:500]}")
    print("\nApps Script API might not be enabled.")
    print("Alternative: Use Web App directly with POST...")
    sys.exit(1)

# 4. Now call setupRichMenuFromProperty via Web App
print("\nCalling setupRichMenuFromProperty...")
webapp_url = 'https://script.google.com/macros/s/AKfycbwWSnmX2HqMwM2xz1ilCgqjG05TQHmg0o4jTNThKHXCI9QpfBEzm8qsWErCOmU6gI6K/exec'
setup_url = f'{webapp_url}?fn=setupRichMenuFromProperty'
req2 = urllib.request.Request(setup_url, headers={'Authorization': f'Bearer {token}'})
resp2 = urllib.request.urlopen(req2)
result2 = json.loads(resp2.read().decode())
print(f"Result: {json.dumps(result2, indent=2, ensure_ascii=False)}")
