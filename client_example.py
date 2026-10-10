"""Contoh klien server-side. Mengunduh ZIP, tidak memasang atau mengeksekusinya."""
import os,json,hashlib,urllib.request
from pathlib import Path
base=os.environ['LICENSE_SERVER_URL'].rstrip('/')
if not base.startswith('https://'):raise ValueError('Gunakan HTTPS')
payload={'license_key':os.environ['LICENSE_KEY'],'domain':os.environ['LICENSE_DOMAIN']}
def post(path,data):
 req=urllib.request.Request(base+path,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'},method='POST')
 with urllib.request.urlopen(req,timeout=60) as r:return r.read()
print(json.loads(post('/api/activate',payload)))
update=json.loads(post('/api/update',dict(payload,current_version=os.getenv('APP_VERSION','0.0.0'))))
if update['has_update']:
 raw=post('/api/download',payload)
 if hashlib.sha256(raw).hexdigest()!=update['sha256']:raise ValueError('Checksum tidak cocok; ulangi pemeriksaan update')
 Path('release.zip').write_bytes(raw)
 print('Paket terverifikasi dan tersimpan. Backup aplikasi sebelum pemasangan manual.')
else:print('Tidak ada paket versi berbeda.')
