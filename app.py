import os, sqlite3, secrets, hashlib, hmac, json, time, html, re
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from http.cookies import SimpleCookie
from email.parser import BytesParser
from email.policy import default
from wsgiref.simple_server import make_server

DATA=Path(os.getenv('DATA_DIR','data')); DATA.mkdir(parents=True,exist_ok=True); (DATA/'files').mkdir(exist_ok=True)
BASE=os.getenv('APP_URL','http://localhost:8000').rstrip('/')
MAX=25*1024*1024

def db():
 c=sqlite3.connect(DATA/'app.db',timeout=20); c.row_factory=sqlite3.Row; c.execute('PRAGMA foreign_keys=ON'); return c

def password(p,s=None):
 s=s or secrets.token_hex(16); return s+':'+hashlib.scrypt(p.encode(),salt=s.encode(),n=16384,r=8,p=1).hex()

def init():
 with db() as c:
  c.executescript('''CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,password TEXT,admin INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER,csrf TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT,price INTEGER,version TEXT DEFAULT '',file TEXT DEFAULT '',sha TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,status TEXT DEFAULT 'pending');
CREATE TABLE IF NOT EXISTS licenses(id INTEGER PRIMARY KEY,order_id INTEGER UNIQUE,key TEXT UNIQUE,user_id INTEGER,product_id INTEGER,status TEXT DEFAULT 'active',seats INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS activations(license_id INTEGER,domain TEXT,PRIMARY KEY(license_id,domain));
CREATE TABLE IF NOT EXISTS limits(ip TEXT PRIMARY KEY,start INTEGER,count INTEGER);''')
  email=os.getenv('ADMIN_EMAIL'); pw=os.getenv('ADMIN_PASSWORD')
  if email and pw and len(pw)>=12: c.execute('INSERT OR IGNORE INTO users(email,password,admin) VALUES(?,?,1)',(email.lower(),password(pw)))

STYLE='''body{margin:0;background:#0b1220;color:#e5edf8;font:15px system-ui}header,main{max-width:1050px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:1px solid #263449}a{color:#5eead4;text-decoration:none}h1{font-size:34px}h2{font-size:21px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.card{background:#142034;border:1px solid #2a3c54;border-radius:16px;padding:22px;margin:14px 0}input,button{padding:12px;border-radius:8px;border:1px solid #3a4c64;margin:6px 0;box-sizing:border-box}input{background:#0b1220;color:white;max-width:100%;width:100%}button{background:#2dd4bf;color:#062c29;cursor:pointer;font-weight:700}small{color:#9fb0c6}code{overflow-wrap:anywhere}nav a{margin-left:16px}.error{color:#fda4af}label{display:block;margin-top:10px}'''
def esc(s): return html.escape(str(s),quote=True)
def page(title,body,user=None):
 nav='<a href="/">Produk</a>'
 if user: nav+='<a href="/member">Membership</a>'+('<a href="/admin">Admin</a>' if user['admin'] else '')+'<a href="/logout">Keluar</a>'
 else: nav+='<a href="/login">Masuk</a><a href="/register">Daftar</a>'
 return f'<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} | RIZQHUB</title><style>{STYLE}</style><header><b>RIZQHUB / MEMBERSHIP</b><nav>{nav}</nav></header><main><h1>{esc(title)}</h1>{body}</main></html>'
def form(action,csrf,body): return f'<form method="post" action="{action}"><input type="hidden" name="csrf" value="{csrf}">{body}</form>'
def domain(s):
 s=s.strip().lower(); p=urlparse(s if '://' in s else 'https://'+s)
 d=p.hostname or ''
 if not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?',d) or '..' in d: raise ValueError('Domain tidak valid')
 return d

class HTTPError(Exception):
 def __init__(self,status,msg):self.status=status;self.msg=msg

def application(env,start):
 c=db(); status='200 OK'; headers=[]; user=None
 try:
  path=env.get('PATH_INFO','/'); method=env['REQUEST_METHOD']; cookie=SimpleCookie(env.get('HTTP_COOKIE','')); token=cookie.get('session'); token=token.value if token else ''
  session=c.execute('SELECT * FROM sessions WHERE token=? AND expires>?',(token,int(time.time()))).fetchone()
  if session:user=c.execute('SELECT * FROM users WHERE id=?',(session['user_id'],)).fetchone()
  if not session:
   token=secrets.token_urlsafe(32); session={'token':token,'user_id':None,'csrf':secrets.token_urlsafe(32),'expires':int(time.time())+86400}
   c.execute('INSERT INTO sessions VALUES(?,?,?,?)',tuple(session.values()));c.commit()
   headers.append(('Set-Cookie',f'session={token}; HttpOnly; SameSite=Lax; Path=/'+('; Secure' if BASE.startswith('https:') else '')))
  fields={}; uploaded=None
  if method=='POST':
   size=int(env.get('CONTENT_LENGTH') or 0)
   if size>MAX:raise HTTPError('413 Payload Too Large','Maksimal unggahan 25 MB')
   raw=env['wsgi.input'].read(size); ct=env.get('CONTENT_TYPE','')
   if ct.startswith('application/json'): fields=json.loads(raw or b'{}')
   elif ct.startswith('multipart/form-data'):
    message=BytesParser(policy=default).parsebytes(('Content-Type: '+ct+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+raw)
    for part in message.iter_parts():
     name=part.get_param('name',header='content-disposition'); content=part.get_payload(decode=True)
     if part.get_filename():uploaded=content
     else:fields[name]=content.decode()
   else:fields={k:v[0] for k,v in parse_qs(raw.decode(),keep_blank_values=True).items()}
  def need(admin=False):
   if not user:raise HTTPError('401 Unauthorized','Silakan masuk terlebih dahulu')
   if admin and not user['admin']:raise HTTPError('403 Forbidden','Hanya admin')
  def redirect(url):
   nonlocal status;status='303 See Other';headers.append(('Location',url));return b''
  def output(title,body): return page(title,body,user).encode()
  def csrf():
   if not hmac.compare_digest(str(fields.get('csrf','')),session['csrf']):raise HTTPError('403 Forbidden','Token form tidak valid. Muat ulang halaman.')
  if path.startswith('/api/'):
   headers.append(('Content-Type','application/json'))
   if method!='POST':raise HTTPError('405 Method Not Allowed','Gunakan POST JSON')
   ip=env.get('REMOTE_ADDR','unknown'); now=int(time.time())
   c.execute('BEGIN IMMEDIATE'); lim=c.execute('SELECT * FROM limits WHERE ip=?',(ip,)).fetchone()
   if lim and now-lim['start']<60 and lim['count']>=60:c.rollback();raise HTTPError('429 Too Many Requests','Coba lagi dalam satu menit')
   if not lim or now-lim['start']>=60:c.execute('INSERT OR REPLACE INTO limits VALUES(?,?,1)',(ip,now))
   else:c.execute('UPDATE limits SET count=count+1 WHERE ip=?',(ip,))
   c.commit()
   d=domain(str(fields.get('domain',''))); key=str(fields.get('license_key',''))
   c.execute('BEGIN IMMEDIATE'); lic=c.execute('SELECT * FROM licenses WHERE key=?',(key,)).fetchone()
   if not lic or lic['status']!='active':raise HTTPError('403 Forbidden','Lisensi tidak aktif atau tidak ditemukan')
   active=c.execute('SELECT 1 FROM activations WHERE license_id=? AND domain=?',(lic['id'],d)).fetchone()
   if path=='/api/activate':
    count=c.execute('SELECT count(*) FROM activations WHERE license_id=?',(lic['id'],)).fetchone()[0]
    if not active and count>=lic['seats']:raise HTTPError('403 Forbidden','Batas aktivasi tercapai')
    c.execute('INSERT OR IGNORE INTO activations VALUES(?,?)',(lic['id'],d)); result={'success':True,'domain':d,'status':'active'}
   elif path in ['/api/validate','/api/update']:
    if not active:raise HTTPError('403 Forbidden','Domain belum diaktifkan')
    result={'success':True,'domain':d,'status':'active'}
    if path=='/api/update':
     p=c.execute('SELECT * FROM products WHERE id=?',(lic['product_id'],)).fetchone()
     result.update(version=p['version'],has_update=bool(p['file'] and p['version']!=fields.get('current_version')),sha256=p['sha'],download_endpoint=BASE+'/api/download')
   elif path=='/api/deactivate':
    c.execute('DELETE FROM activations WHERE license_id=? AND domain=?',(lic['id'],d));result={'success':True}
   elif path=='/api/download':
    if not active:raise HTTPError('403 Forbidden','Domain belum diaktifkan')
    p=c.execute('SELECT * FROM products WHERE id=?',(lic['product_id'],)).fetchone()
    if not p['file']:raise HTTPError('404 Not Found','Belum ada rilis')
    headers=[('Content-Type','application/zip'),('Content-Disposition','attachment; filename="release.zip"')];c.commit();body=(DATA/'files'/p['file']).read_bytes();start(status,headers);return [body]
   else:raise HTTPError('404 Not Found','Endpoint tidak tersedia')
   c.commit();body=json.dumps(result).encode()
  else:
   headers.append(('Content-Type','text/html; charset=utf-8'))
   if method=='POST':csrf()
   if path in ['/login','/register']:
    title='Masuk' if path=='/login' else 'Buat akun'
    if method=='POST':
     email=fields.get('email','').strip().lower();pw=fields.get('password','')
     if path=='/register':
      if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(pw)<12:raise ValueError('Email valid dan password minimal 12 karakter diperlukan')
      c.execute('INSERT INTO users(email,password) VALUES(?,?)',(email,password(pw)));c.commit()
     u=c.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
     if not u or not hmac.compare_digest(u['password'],password(pw,u['password'].split(':')[0])):raise HTTPError('401 Unauthorized','Email atau password salah')
     new=secrets.token_urlsafe(32);c.execute('DELETE FROM sessions WHERE token=?',(token,));c.execute('INSERT INTO sessions VALUES(?,?,?,?)',(new,u['id'],secrets.token_urlsafe(32),int(time.time())+86400));c.commit()
     headers.append(('Set-Cookie',f'session={new}; HttpOnly; SameSite=Lax; Path=/'+('; Secure' if BASE.startswith('https:') else '')));body=redirect('/member')
    else:body=output(title,'<div class="card">'+form(path,session['csrf'],'<label>Email</label><input type="email" name="email" required><label>Password</label><input type="password" name="password" minlength="12" required><button>Lanjutkan</button>')+'</div>')
   elif path=='/logout':
    if method=='POST':c.execute('DELETE FROM sessions WHERE token=?',(token,));c.commit();body=redirect('/login')
    else:body=output('Keluar',form('/logout',session['csrf'],'<button>Konfirmasi keluar</button>'))
   elif path=='/':
    cards=''
    for p in c.execute('SELECT * FROM products'):
     cards+=f'<div class="card"><h2>{esc(p["name"])}</h2><p>Rp {p["price"]:,}</p><small>Versi {esc(p["version"] or "belum dirilis")}</small>'+form('/order',session['csrf'],f'<input type="hidden" name="product_id" value="{p["id"]}"><button>Pesan aplikasi</button>')+'</div>'
    body=output('Aplikasi untuk bisnis Anda','<p>Beli aplikasi, unduh source code, dan kelola lisensi melalui satu akun.</p><div class="grid">'+(cards or '<div class="card">Produk belum tersedia.</div>')+'</div>')
   elif path=='/order':
    need()
    if method!='POST':raise HTTPError('405 Method Not Allowed','Gunakan form pemesanan')
    pid=int(fields['product_id'])
    if not c.execute('SELECT 1 FROM products WHERE id=?',(pid,)).fetchone():raise ValueError('Produk tidak ditemukan')
    c.execute('INSERT INTO orders(user_id,product_id) VALUES(?,?)',(user['id'],pid));c.commit();body=redirect('/member')
   elif path=='/member':
    need(); cards=''
    for o in c.execute('SELECT o.*,p.name,p.version,l.key,l.status AS license_status FROM orders o JOIN products p ON p.id=o.product_id LEFT JOIN licenses l ON l.order_id=o.id WHERE o.user_id=? ORDER BY o.id DESC',(user['id'],)):
     cards+=f'<div class="card"><h2>{esc(o["name"])}</h2><p>Pesanan #{o["id"]} · {esc(o["status"])}</p>'
     if o['key']:cards+=f'<p>License key: <code>{esc(o["key"])}</code></p><p>Lisensi: {esc(o["license_status"])}</p><a href="/download?order={o["id"]}">Unduh source terbaru ({esc(o["version"])})</a>'
     else:cards+='<small>Hubungi admin untuk instruksi pembayaran. Admin mengonfirmasi setelah memeriksa pembayaran.</small>'
     cards+='</div>'
    body=output('Membership saya',cards or '<div class="card">Belum ada pembelian. <a href="/">Lihat produk</a></div>')
   elif path=='/download':
    need();oid=int(parse_qs(env.get('QUERY_STRING','')).get('order',['0'])[0]);p=c.execute("SELECT p.file FROM orders o JOIN products p ON p.id=o.product_id JOIN licenses l ON l.order_id=o.id WHERE o.id=? AND o.user_id=? AND o.status='paid' AND l.status='active'",(oid,user['id'])).fetchone()
    if not p or not p['file']:raise HTTPError('403 Forbidden','File belum tersedia atau akses tidak aktif')
    headers=[('Content-Type','application/zip'),('Content-Disposition','attachment; filename="source.zip"')];body=(DATA/'files'/p['file']).read_bytes()
   elif path=='/admin':
    need(True);bodyhtml='<div class="card"><h2>Tambah produk</h2>'+form('/admin/product',session['csrf'],'<input name="name" placeholder="Nama aplikasi" required><input name="price" type="number" min="0" placeholder="Harga rupiah" required><button>Simpan produk</button>')+'</div>'
    for p in c.execute('SELECT * FROM products'):
     bodyhtml+=f'<div class="card"><h2>{esc(p["name"])}</h2><small>Versi {esc(p["version"])}</small><form method="post" enctype="multipart/form-data" action="/admin/release"><input type="hidden" name="csrf" value="{session["csrf"]}"><input type="hidden" name="product_id" value="{p["id"]}"><input name="version" placeholder="Versi, contoh 1.0.0" required><input type="file" name="file" accept=".zip" required><button>Unggah rilis ZIP</button></form></div>'
    bodyhtml+='<h2>Pesanan</h2>'
    for o in c.execute('SELECT o.*,u.email,p.name FROM orders o JOIN users u ON u.id=o.user_id JOIN products p ON p.id=o.product_id ORDER BY o.id DESC'):
     bodyhtml+=f'<div class="card">#{o["id"]} · {esc(o["email"])} · {esc(o["name"])} · {esc(o["status"])}'
     if o['status']=='pending':bodyhtml+=form('/admin/approve',session['csrf'],f'<input type="hidden" name="order_id" value="{o["id"]}"><button>Konfirmasi pembayaran dan terbitkan lisensi</button>')
     bodyhtml+='</div>'
    bodyhtml+='<h2>Lisensi pelanggan</h2>'
    for l in c.execute('SELECT * FROM licenses'):
     bodyhtml+=f'<div class="card"><code>{esc(l["key"])}</code> · {esc(l["status"])}'+form('/admin/license',session['csrf'],f'<input type="hidden" name="id" value="{l["id"]}"><label>Batas aktivasi</label><input type="number" min="1" max="100" name="seats" value="{l["seats"]}"><select name="status"><option value="active" {"selected" if l["status"]=="active" else ""}>Active</option><option value="suspended" {"selected" if l["status"]=="suspended" else ""}>Suspended</option></select><button>Simpan</button>')+'</div>'
    body=output('Panel admin',bodyhtml)
   elif path.startswith('/admin/'):
    need(True)
    if method!='POST':raise HTTPError('405 Method Not Allowed','Gunakan POST')
    if path=='/admin/product':
     name=fields['name'].strip();price=int(fields['price'])
     if not name or price<0:raise ValueError('Nama atau harga tidak valid')
     c.execute('INSERT INTO products(name,price) VALUES(?,?)',(name,price))
    elif path=='/admin/release':
     import zipfile,io
     pid=int(fields['product_id']);version=fields['version'].strip()
     if not c.execute('SELECT 1 FROM products WHERE id=?',(pid,)).fetchone():raise ValueError('Produk tidak ditemukan')
     if not re.fullmatch(r'\d+\.\d+\.\d+',version) or not uploaded or not zipfile.is_zipfile(io.BytesIO(uploaded)):raise ValueError('Versi harus x.y.z dan file harus ZIP')
     name=secrets.token_hex(24)+'.zip';(DATA/'files'/name).write_bytes(uploaded);c.execute('UPDATE products SET version=?,file=?,sha=? WHERE id=?',(version,name,hashlib.sha256(uploaded).hexdigest(),pid))
    elif path=='/admin/approve':
     c.execute('BEGIN IMMEDIATE');o=c.execute('SELECT * FROM orders WHERE id=?',(int(fields['order_id']),)).fetchone()
     if not o:raise ValueError('Pesanan tidak ditemukan')
     c.execute("UPDATE orders SET status='paid' WHERE id=?",(o['id'],));c.execute('INSERT OR IGNORE INTO licenses(order_id,key,user_id,product_id) VALUES(?,?,?,?)',(o['id'],'RIZQ-'+secrets.token_hex(20).upper(),o['user_id'],o['product_id']))
    elif path=='/admin/license':
     seats=int(fields['seats']);st=fields['status']
     if not 1<=seats<=100 or st not in ['active','suspended']:raise ValueError('Pengaturan tidak valid')
     c.execute('UPDATE licenses SET seats=?,status=? WHERE id=?',(seats,st,int(fields['id'])))
    else:raise HTTPError('404 Not Found','Halaman tidak ditemukan')
    c.commit();body=redirect('/admin')
   elif path=='/health':body=b'OK'
   else:raise HTTPError('404 Not Found','Halaman tidak ditemukan')
 except (HTTPError,ValueError,KeyError,sqlite3.IntegrityError) as e:
  c.rollback();status=e.status if isinstance(e,HTTPError) else '400 Bad Request';msg=e.msg if isinstance(e,HTTPError) else ('Email sudah terdaftar' if isinstance(e,sqlite3.IntegrityError) else str(e))
  body=json.dumps({'success':False,'message':msg}).encode() if env.get('PATH_INFO','').startswith('/api/') else page('Permintaan gagal',f'<p class="error">{esc(msg)}</p><a href="/">Kembali</a>',user).encode()
 except Exception:
  c.rollback();status='500 Internal Server Error';body=b'Internal server error'
 finally:c.close()
 headers.extend([('X-Content-Type-Options','nosniff'),('X-Frame-Options','DENY'),('Cache-Control','no-store'),('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'")]);start(status,headers);return [body]

init()
if __name__=='__main__':make_server('0.0.0.0',8000,application).serve_forever()
