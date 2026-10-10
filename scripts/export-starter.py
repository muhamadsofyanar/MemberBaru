"""Jalankan pada snapshot /data versi Python. Jangan unggah hasil ke Git."""
import sqlite3,json,sys,base64,hashlib
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '/data');out=Path(sys.argv[2] if len(sys.argv)>2 else 'starter-export.json')
c=sqlite3.connect(f'file:{root / "app.db"}?mode=ro',uri=True);c.row_factory=sqlite3.Row
c.execute('BEGIN')
data={'format':'rizqhub-starter-0.1','tables':{}}
for table in ['users','products','orders','licenses','activations']:data['tables'][table]=[dict(row) for row in c.execute('SELECT * FROM '+table)]
data['files']={}
for p in data['tables']['products']:
 if p['file']:
  if Path(p['file']).name!=p['file']:raise ValueError('Nama file tidak valid')
  raw=(root/'files'/p['file']).read_bytes()
  if p['sha'] and hashlib.sha256(raw).hexdigest()!=p['sha']:raise ValueError('Checksum file tidak cocok')
  data['files'][p['file']]=base64.b64encode(raw).decode()
c.rollback();c.close()
with out.open('x') as f:json.dump(data,f)
out.chmod(0o600)
print('Ekspor selesai. Berisi hash password dan license key; simpan privat.')
