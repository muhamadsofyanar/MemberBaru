// Run only against a disposable seeded database: node tests/integration.mjs
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {createHash} from 'node:crypto';
if(process.env.RUN_INTEGRATION_TESTS!=="1")throw new Error("Use a disposable test database and set RUN_INTEGRATION_TESTS=1.");
const db=new PrismaClient();
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
let count=0;
async function request(path,data,cookie='',method='POST'){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data),redirect:'manual'});
 const body=await response.json().catch(()=>({}));return {status:response.status,body,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
function check(ok,message){assert.ok(ok,message);console.log('PASS '+message);count++;}
async function login(email,password){const r=await request('/api/auth/login',{email,password});assert.equal(r.status,200,JSON.stringify(r));return r.cookie;}
try{
 const admin=await login('admin@test.invalid','test-admin-password-123');
 const suffix=Date.now().toString();
 const affiliate=await request('/api/auth/register',{name:'Affiliate Test',phone:'628123456789',email:`affiliate-${suffix}@test.invalid`,password:'password-test-123'});
 check(affiliate.status===200,'member registration');
 const aff=await db.user.findUniqueOrThrow({where:{email:`affiliate-${suffix}@test.invalid`}});
 const buyerEmail=`buyer-${suffix}@test.invalid`;
 const buyer=await request('/api/auth/register',{name:'Buyer Test',phone:'628123456788',email:buyerEmail,password:'password-test-123',ref:aff.referralCode});
 check(buyer.status===200,'referral registration');
 const buyerUser=await db.user.findUniqueOrThrow({where:{email:buyerEmail}});
 const profile=await request('/api/profile',{name:'Updated Buyer',phone:'628123456787'},buyer.cookie,'PATCH');check(profile.status===200,'edit profile');
 const badPassword=await request('/api/profile',{action:'password',currentPassword:'wrong',password:'new-password-123'},buyer.cookie,'PATCH');check(badPassword.status===400,'reject wrong current password');
 const password=await request('/api/profile',{action:'password',currentPassword:'password-test-123',password:'new-password-123'},buyer.cookie,'PATCH');check(password.status===200,'change password');
 const oldSession=await request('/api/profile',{name:'Stale Session',phone:'628123456787'},buyer.cookie,'PATCH');check(oldSession.status===401,'invalidate old session');
 const cookie=await login(buyerEmail,'new-password-123');
 const plan=await db.plan.findFirstOrThrow({where:{slug:'starter'}});
 const form=new FormData();form.set('planId',plan.id);form.set('transferAccount','Test Account');form.set('proof',new Blob([Buffer.from('89504e470d0a1a0a','hex')],{type:'image/png'}),'proof.png');
 const upload=await fetch(base+'/api/orders',{method:'POST',headers:{Cookie:cookie,Origin:base},body:form});check(upload.status===200,'upload payment proof');
 const order=await db.order.findFirstOrThrow({where:{userId:buyerUser.id}});
 const proof=await fetch(base+`/api/admin/orders/${order.id}/proof`,{headers:{Cookie:admin}});check(proof.status===200&&proof.headers.get('content-type')==='image/png','admin can open evidence');
 const forbidden=await fetch(base+`/api/admin/orders/${order.id}/proof`,{headers:{Cookie:cookie}});check(forbidden.status===403,'member cannot read admin payment proof');
 const paid=await request(`/api/admin/orders/${order.id}`,{status:'PAID'},admin,'PATCH');check(paid.status===200,'approve payment');
 const repeat=await request(`/api/admin/orders/${order.id}`,{status:'PAID'},admin,'PATCH');check(repeat.status===409,'reject duplicate approval');
 check(await db.membership.count({where:{orderId:order.id}})===1,'one membership per order');
 check(await db.commission.count({where:{orderId:order.id}})===1,'one referral commission per order');
 const withdrawn=await request('/api/payouts',{bankName:'Test Bank',accountNumber:'1234567890',accountName:'Affiliate Test'},affiliate.cookie);check(withdrawn.status===200,'request payout');
 const duplicate=await request('/api/payouts',{bankName:'Test Bank',accountNumber:'1234567890',accountName:'Affiliate Test'},affiliate.cookie);check(duplicate.status===409,'reject duplicate payout request');
 const payout=await db.payout.findFirstOrThrow({where:{userId:aff.id}});
 const skip=await request(`/api/admin/payouts/${payout.id}`,{status:'PAID',transferReference:'TEST'},admin,'PATCH');check(skip.status===409,'cannot skip payout approval');
 check((await request(`/api/admin/payouts/${payout.id}`,{status:'REJECTED',reviewNote:'Wrong account'},admin,'PATCH')).status===200,'reject payout');
 check((await db.commission.findFirstOrThrow({where:{orderId:order.id}})).payoutId===null,'rejection releases commission');
 check((await request('/api/payouts',{bankName:'Test Bank',accountNumber:'1234567890',accountName:'Affiliate Test'},affiliate.cookie)).status===200,'reapply after rejection');
 const p2=await db.payout.findFirstOrThrow({where:{userId:aff.id,status:'PENDING'}});
 check((await request(`/api/admin/payouts/${p2.id}`,{status:'APPROVED'},admin,'PATCH')).status===200,'approve payout');
 check((await request(`/api/admin/payouts/${p2.id}`,{status:'PAID',transferReference:'TEST-TRANSFER'},admin,'PATCH')).status===200,'record paid payout');
 check((await db.commission.findFirstOrThrow({where:{orderId:order.id}})).status==='PAID','paid commission recorded');
 const token='a'.repeat(64);await db.passwordReset.create({data:{userId:buyerUser.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+60000)}});
 check((await request('/api/auth/reset-password',{token,password:'reset-password-123'})).status===200,'single-use password reset');
 check((await request('/api/auth/reset-password',{token,password:'reset-password-456'})).status===400,'reject reused reset token');
 await login(buyerEmail,'reset-password-123');count++;console.log('PASS login after reset');
 check((await request('/api/profile',{name:'No',phone:'628123456787'},cookie,'PATCH')).status===401,'reset invalidates sessions');
 const cross=await fetch(base+'/api/profile',{method:'PATCH',headers:{Origin:'https://other.invalid','Content-Type':'application/json',Cookie:cookie},body:'{}'});check(cross.status===403,'reject cross-origin mutation');
 // Non-member cannot see protected content, but can read previews.
 const course=await db.course.findUniqueOrThrow({where:{slug:'fondasi-bisnis-digital'},include:{modules:{include:{lessons:{orderBy:{position:'asc'}}}}}});
 const preview=course.modules[0].lessons.find(l=>l.isPreview),locked=course.modules[0].lessons.find(l=>!l.isPreview);
 const previewRes=await fetch(base+`/dashboard/courses/${course.slug}/${preview.id}`,{headers:{Cookie:affiliate.cookie},redirect:'manual'});check(previewRes.status===200&&(await previewRes.text()).includes(preview.content),'read free preview without membership');
 const lockedRes=await fetch(base+`/dashboard/courses/${course.slug}/${locked.id}`,{headers:{Cookie:affiliate.cookie},redirect:'manual'});check(!(await lockedRes.text()).includes(locked.content),'paid lesson content remains protected');
 check((await request(`/api/progress/${preview.id}`,{},affiliate.cookie)).status===200,'complete free preview');
 check((await request(`/api/progress/${locked.id}`,{},affiliate.cookie)).status===403,'deny progress for inaccessible paid lesson');
 console.log(`Integration checks passed: ${count}`);
}finally{await db.$disconnect();}
