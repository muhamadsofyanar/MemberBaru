import os,tempfile,unittest,io,json,re,zipfile
from urllib.parse import urlencode
os.environ['DATA_DIR']=tempfile.mkdtemp();os.environ['ADMIN_EMAIL']='admin@example.test';os.environ['ADMIN_PASSWORD']='test-only-password-123'
import app
class Flow(unittest.TestCase):
 def req(self,path,fields=None,cookie='',api=False):
  raw=(json.dumps(fields).encode() if api else urlencode(fields).encode()) if fields is not None else b'';out={}
  env={'PATH_INFO':path.split('?')[0],'QUERY_STRING':path.partition('?')[2],'REQUEST_METHOD':'POST' if fields is not None else 'GET','CONTENT_LENGTH':str(len(raw)),'CONTENT_TYPE':'application/json' if api else 'application/x-www-form-urlencoded','wsgi.input':io.BytesIO(raw),'HTTP_COOKIE':cookie,'REMOTE_ADDR':'127.0.0.1'}
  body=b''.join(app.application(env,lambda s,h:out.update(status=s,headers=h)))
  cookies=[v.split(';')[0] for k,v in out['headers'] if k=='Set-Cookie'];return out['status'],body,cookies[-1] if cookies else cookie
 def login(self,email,pw):
  _,_,ck=self.req('/login')
  with app.db() as c: csrf=c.execute('SELECT csrf FROM sessions WHERE token=?',(ck.split('=')[1],)).fetchone()[0]
  st,_,ck=self.req('/login',{'email':email,'password':pw,'csrf':csrf},ck);self.assertTrue(st.startswith('303'))
  with app.db() as c: csrf=c.execute('SELECT csrf FROM sessions WHERE token=?',(ck.split('=')[1],)).fetchone()[0]
  return ck,csrf
 def test_purchase_license_update(self):
  admin,csrf=self.login('admin@example.test','test-only-password-123')
  st,_,_=self.req('/admin/product',{'name':'Demo Software','price':120000,'csrf':csrf},admin);self.assertTrue(st.startswith('303'))
  _,_,ck=self.req('/register')
  with app.db() as c: cs=c.execute('SELECT csrf FROM sessions WHERE token=?',(ck.split('=')[1],)).fetchone()[0]
  st,_,_=self.req('/register',{'email':'buyer@example.test','password':'buyer-test-password-123','csrf':cs},ck);self.assertTrue(st.startswith('303'))
  buyer,bcsrf=self.login('buyer@example.test','buyer-test-password-123')
  self.assertTrue(self.req('/admin',cookie=buyer)[0].startswith('403'))
  self.assertTrue(self.req('/order',{'product_id':1,'csrf':'wrong'},buyer)[0].startswith('403'))
  self.assertTrue(self.req('/order',{'product_id':1,'csrf':bcsrf},buyer)[0].startswith('303'))
  for _ in range(2):self.assertTrue(self.req('/admin/approve',{'order_id':1,'csrf':csrf},admin)[0].startswith('303'))
  with app.db() as c:
   self.assertEqual(c.execute('SELECT count(*) FROM licenses').fetchone()[0],1);key=c.execute('SELECT key FROM licenses').fetchone()[0]
   bio=io.BytesIO()
   with zipfile.ZipFile(bio,'w') as z:z.writestr('hello.txt','test release')
   raw=bio.getvalue();(app.DATA/'files'/'test.zip').write_bytes(raw);c.execute('UPDATE products SET version=?,file=?,sha=? WHERE id=1',('1.0.0','test.zip',app.hashlib.sha256(raw).hexdigest()))
  p={'license_key':key,'domain':'buyer.example'}
  self.assertTrue(self.req('/api/validate',p,api=True)[0].startswith('403'))
  for _ in range(2):self.assertTrue(self.req('/api/activate',p,api=True)[0].startswith('200'))
  self.assertTrue(self.req('/api/activate',dict(p,domain='other.example'),api=True)[0].startswith('403'))
  st,b,_=self.req('/api/update',dict(p,current_version='0.0.0'),api=True);self.assertTrue(json.loads(b)['has_update'])
  self.assertEqual(self.req('/api/download',p,api=True)[1],raw)
  self.assertEqual(self.req('/download?order=1',cookie=buyer)[1],raw)
  self.assertTrue(self.req('/admin/license',{'id':1,'seats':1,'status':'suspended','csrf':csrf},admin)[0].startswith('303'))
  self.assertTrue(self.req('/api/download',p,api=True)[0].startswith('403'))
  self.assertTrue(self.req('/download?order=1',cookie=buyer)[0].startswith('403'))
if __name__=='__main__':unittest.main()
