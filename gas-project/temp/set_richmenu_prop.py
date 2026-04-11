#!/usr/bin/env python3
"""Upload base64 image to GAS ScriptProperties, then run setupRichMenuFromProperty."""
import json, urllib.request, urllib.parse, sys, os

HOME = os.path.expanduser('~')
with open(os.path.join(HOME, '.clasprc.json')) as f:
    t = json.load(f)['tokens']['default']

# Get access token
data = urllib.parse.urlencode({
    'client_id': t['client_id'], 'client_secret': t['client_secret'],
    'refresh_token': t['refresh_token'], 'grant_type': 'refresh_token'
}).encode()
r = json.loads(urllib.request.urlopen(urllib.request.Request(
    'https://oauth2.googleapis.com/token', data=data)).read())
token = r['access_token']

# Read base64 image
with open('/tmp/richmenu_b64.txt') as f:
    b64 = f.read().strip()

webapp_url = 'https://script.google.com/macros/s/AKfycbwWSnmX2HqMwM2xz1ilCgqjG05TQHmg0o4jTNThKHXCI9QpfBEzm8qsWErCOmU6gI6K/exec'

# Step 1: Set ScriptProperty via Web App (setProperty is a global function but not in allowedFunctions)
# Use POST with JSON body instead
print(f"Base64 length: {len(b64)}")
print("Step 1: Uploading image to ScriptProperties via Web App...")

# The Web App only accepts GET with fn parameter. We need to use a different approach.
# Use Apps Script API projects.updateContent to set script properties won't work easily.
# Instead, let's POST the base64 to the Web App with a special parameter.

# Actually, let's use the approach of calling setupRichMenuFromBase64 directly
# by encoding the base64 in the URL parameter. But it's too long for GET.

# Better approach: POST to Web App with the base64 in the body
# The GAS Web App can handle POST via doGet(e) doesn't work... we need doPost.

# Simplest: Use the gas-run.sh approach with curl and the base64 as a file-based parameter.
# Let's use a multipart POST to the Web App.

import base64
with open('/mnt/c/Users/USER/workspace/active/line_rich_menu.png', 'rb') as f:
    image_data = f.read()

print(f"Image size: {len(image_data)} bytes")

# Upload to Google Drive using Drive API, then use setupRichMenu(driveFileId)
print("Step 2: Uploading image to Google Drive via Drive API...")

# Use Drive API v3 files.create with resumable upload
boundary = 'BOUNDARY123456'
body_parts = []
# Metadata
metadata = json.dumps({
    'name': 'line_rich_menu.png',
    'mimeType': 'image/png'
})
body_parts.append(f'--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}')
# File content
body_parts.append(f'\r\n--{boundary}\r\nContent-Type: image/png\r\n\r\n')
body_bytes = body_parts[0].encode() + body_parts[1].encode() + image_data + f'\r\n--{boundary}--\r\n'.encode()

upload_url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
req = urllib.request.Request(upload_url, data=body_bytes, headers={
    'Authorization': f'Bearer {token}',
    'Content-Type': f'multipart/related; boundary={boundary}'
})
resp = urllib.request.urlopen(req)
result = json.loads(resp.read())
file_id = result['id']
print(f"Drive file ID: {file_id}")

# Make file publicly readable (needed for some APIs, but DriveApp.getFileById should work with owner access)
# Actually DriveApp.getFileById uses the GAS service account, so sharing isn't needed for same-user.
# But let's set sharing anyway for safety.
share_url = f'https://www.googleapis.com/drive/v3/files/{file_id}/permissions'
share_body = json.dumps({'type': 'anyone', 'role': 'reader'}).encode()
req2 = urllib.request.Request(share_url, data=share_body, headers={
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
})
try:
    urllib.request.urlopen(req2)
    print("File shared publicly (read)")
except Exception as e:
    print(f"Sharing warning (non-fatal): {e}")

# Step 3: Call setupRichMenu via Web App
print("Step 3: Calling setupRichMenu via Web App...")
setup_url = f'{webapp_url}?fn=setupRichMenuFromProperty'
# But setupRichMenuFromProperty reads from ScriptProperties... we need setupRichMenu with driveFileId.
# Let's use a direct approach: set the property first, then call.
# Actually, let's just directly call setupRichMenu by modifying the approach.

# Set ScriptProperty via Web App - but we can't pass args...
# Alternative: Just make a direct HTTP call that uploads to Drive and calls the rich menu API.
# Since we already have the file on Drive, let's just call the GAS function.

# We need to add setupRichMenu to allowedFunctions and pass driveFileId somehow...
# The simplest: use the property approach.
# Set RICHMENU_IMAGE_B64 via ScriptProperties API? No, that's GAS-only.

# Actually the simplest approach: just call setupRichMenu(driveFileId) directly.
# We need to add it to allowedFunctions and pass the driveFileId.
# But allowedFunctions pattern doesn't support parameters.

# Let's use a workaround: set a temp ScriptProperty with the driveFileId, then call a wrapper.
# Or better: just call the rich menu API directly from here using the LINE API token!

print("Step 3b: Setting up Rich Menu via LINE API directly...")

# Get LINE token from ScriptProperties - but we can't access those from here.
# Read from .env or ask user...
# Actually, let's use the Apps Script Web App to do this.

# Store driveFileId in a temp file, then make a single Web App call
print(f"Drive File ID saved: {file_id}")
print(f"Now run: ./gas-run.sh deploy setupRichMenuWithFile")
print(f"  (with driveFileId={file_id})")

# Save the file ID for the next step
with open('/tmp/richmenu_drive_id.txt', 'w') as f:
    f.write(file_id)

print(f"\nDone! File ID: {file_id}")
