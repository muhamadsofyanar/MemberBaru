import {PrismaClient} from '@prisma/client';
import {readFileSync,mkdirSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const db=new PrismaClient();const made:string[]=[];
async function main(){
 const filename=process.argv[2];if(!filename)throw new Error('Berikan path starter-export.json');
 const source=JSON.parse(readFileSync(filename,'utf8'));
 if(source.format!=='rizqhub-starter-0.1')throw new Error('Format tidak valid');
 const t=source.tables;const root=process.env.PRIVATE_STORAGE_DIR||'/data/private';mkdirSync(join(root,'product-assets','import'),{recursive:true});
 const fileMap=new Map<number,{storageKey:string,size:number,sha:string}>();
 for(const p of t.products){if(!p.file)continue;const raw=Buffer.from(source.files[p.file]||'','base64');const sha=createHash('sha256').update(raw).digest('hex');if(!raw.length||(p.sha&&sha!==p.sha))throw new Error('Checksum ekspor tidak valid');const storageKey='product-assets/import/'+randomUUID()+'.zip';const target=join(root,storageKey);writeFileSync(target,raw,{flag:'wx'});made.push(target);fileMap.set(p.id,{storageKey,size:raw.length,sha});}
 await db.$transaction(async tx=>{
 if(await tx.order.count()||await tx.softwareLicense.count()||await tx.product.count())throw new Error('Migrasi hanya ke database tujuan baru tanpa produk/pesanan/lisensi. Jangan jalankan seed demo sebelum migrasi.');
 const users=new Map<number,string>();
 for(const u of t.users){const existing=await tx.user.findUnique({where:{email:u.email}});if(existing){if(existing.role!==(u.admin?'ADMIN':'MEMBER'))throw new Error('Role email tujuan berbeda');users.set(u.id,existing.id);continue;}const created=await tx.user.create({data:{id:'starter-user-'+u.id,email:u.email,name:u.email.split('@')[0],passwordHash:u.password,role:u.admin?'ADMIN':'MEMBER',referralCode:'S'+randomUUID().replaceAll('-','').slice(0,16)}});users.set(u.id,created.id);}
 for(const p of t.products){const productId='starter-product-'+p.id;await tx.product.create({data:{id:productId,slug:'starter-'+p.id,type:'TEMPLATE',name:p.name,description:'Software diimpor dari RIZQHUB Starter',price:p.price,status:'PUBLISHED',licenseEnabled:true,affiliatePercent:0}});const f=fileMap.get(p.id);if(f){await tx.productAsset.create({data:{id:'starter-asset-'+p.id,productId,originalName:p.name.replace(/[^a-z0-9-]/gi,'-')+'.zip',mime:'application/zip',size:f.size,storageKey:f.storageKey}});await tx.softwareRelease.create({data:{productId,assetId:'starter-asset-'+p.id,version:p.version||'1.0.0',sha256:f.sha}});}}
 for(const o of t.orders){const p=t.products.find((x:any)=>x.id===o.product_id);if(!p||!users.has(o.user_id))throw new Error('Relasi ekspor tidak valid');const id='starter-order-'+o.id,productId='starter-product-'+p.id;await tx.order.create({data:{id,invoice:'STARTER-'+o.id,userId:users.get(o.user_id)!,amount:p.price,subtotal:p.price,discountTotal:0,status:o.status==='paid'?'PAID':o.status==='pending'?'PENDING':'REJECTED',paidAt:o.status==='paid'?new Date():null,notes:'Migrasi Starter; waktu asli tidak tersedia',items:{create:{id:'starter-item-'+o.id,productId,productSnapshotName:p.name,productSnapshotType:'TEMPLATE',price:p.price,netPrice:p.price,affiliatePercent:0}}}});
 if(fileMap.has(p.id)){const grant=await tx.orderGrant.create({data:{orderId:id,orderItemId:'starter-item-'+o.id,kind:'ASSET',grantRefId:'starter-asset-'+p.id,snapshotName:p.name,productId}});if(o.status==='paid')await tx.entitlement.create({data:{userId:users.get(o.user_id)!,orderGrantId:grant.id,kind:'ASSET',grantRefId:'starter-asset-'+p.id,productId}});}}
 for(const l of t.licenses){if(!users.has(l.user_id))throw new Error('User lisensi tidak ditemukan');await tx.softwareLicense.create({data:{id:'starter-license-'+l.id,key:l.key,userId:users.get(l.user_id)!,productId:'starter-product-'+l.product_id,orderId:'starter-order-'+l.order_id,status:l.status,maxSeats:l.seats}});}
 for(const a of t.activations)await tx.softwareActivation.create({data:{licenseId:'starter-license-'+a.license_id,domain:a.domain}});
 },{timeout:120000});
 console.log('Migrasi selesai. Akun, produk, pesanan, lisensi dan file diimpor. Sesi lama tidak diimpor.');
}
main().catch(e=>{for(const p of made)if(existsSync(p))unlinkSync(p);console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
