#!/usr/bin/env python3
"""Upload rich menu image in chunks via Web App, then setup."""
import json, urllib.request, urllib.parse, os, math

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
print("Token OK")

def call_fn(fn, p1=None):
    url = f'{WEBAPP_URL}?fn={fn}'
    if p1:
        url += f'&p1={urllib.parse.quote(p1, safe="")}'
    # Google Web App redirects; follow redirects without Auth header
    req = urllib.request.Request(url)
    try:
        resp = urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:500]
        print(f"  HTTPError {e.code}: {body}")
        raise
    return json.loads(resp.read().decode())

# 2. Clear existing
print("Clearing existing...")
r = call_fn('clearRichMenuImage')
print(f"  Clear: {r}")

# 3. Read base64 and send in chunks
with open('/tmp/richmenu_b64.txt') as f:
    b64 = f.read().strip()

CHUNK_SIZE = 1800  # GAS URL param limit is ~2KB
total_chunks = math.ceil(len(b64) / CHUNK_SIZE)
print(f"Base64 length: {len(b64)}, chunks: {total_chunks}")

for i in range(total_chunks):
    chunk = b64[i * CHUNK_SIZE : (i + 1) * CHUNK_SIZE]
    r = call_fn('storeRichMenuImage', chunk)
    if not r.get('ok'):
        print(f"  Chunk {i+1}/{total_chunks} FAILED: {r}")
        break
    if (i + 1) % 5 == 0 or i + 1 == total_chunks:
        print(f"  Chunk {i+1}/{total_chunks}: length={r.get('length', '?')}")

# 4. Setup Rich Menu
print("\nSetting up Rich Menu...")
r = call_fn('setupRichMenuFromProperty')
print(f"Result: {json.dumps(r, indent=2, ensure_ascii=False)}")
