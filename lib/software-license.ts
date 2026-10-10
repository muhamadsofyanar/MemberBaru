import {randomBytes} from "node:crypto";
import {ApiError,rateLimit} from "./api";
import {db,PRISMA_SERIALIZABLE,isConflict} from "./db";
import {normalizeDomain,versionGreater} from "./license-utils";
export async function issueSoftwareLicenses(tx:any,order:any){
 const ids=[...new Set((order.items||[]).map((i:any)=>i.productId).filter(Boolean))];
 for(const productId of ids){const p=await tx.product.findUnique({where:{id:productId}});if(!p?.licenseEnabled)continue;
 await tx.softwareLicense.upsert({where:{orderId_productId:{orderId:order.id,productId}},update:{},create:{orderId:order.id,productId,userId:order.userId,key:"RIZQ-"+randomBytes(20).toString("hex").toUpperCase()}});}
}
export async function softwareAction(action:string,input:any){
 if(typeof input.license_key!=="string"||input.license_key.length>100||typeof input.domain!=="string"||input.domain.length>300)throw new ApiError("license_key dan domain diperlukan");
 let domain:string;try{domain=normalizeDomain(input.domain);}catch{throw new ApiError("Domain tidak valid");} await rateLimit(`software:${input.license_key}`,60,1);
 for(let attempt=0;attempt<3;attempt++){try{return await db.$transaction(async tx=>{
 const license=await tx.softwareLicense.findUnique({where:{key:input.license_key}});
 if(!license||license.status!=="active"||(license.expiresAt&&license.expiresAt<=new Date()))throw new ApiError("Lisensi tidak aktif atau kedaluwarsa",403);
 const user=await tx.user.findUnique({where:{id:license.userId}});if(!user?.isActive)throw new ApiError("Akun tidak aktif",403);
 const where={licenseId_domain:{licenseId:license.id,domain}};const active=await tx.softwareActivation.findUnique({where});
 if(action==="activate"){
  if(!active&&await tx.softwareActivation.count({where:{licenseId:license.id}})>=license.maxSeats)throw new ApiError("Batas aktivasi tercapai",403);
  await tx.softwareActivation.upsert({where,update:{lastSeenAt:new Date()},create:{licenseId:license.id,domain}});
 }else if(action==="deactivate"){await tx.softwareActivation.deleteMany({where:{licenseId:license.id,domain}});}
 else if(!active)throw new ApiError("Domain belum diaktifkan",403);
 if(action==="update"||action==="download"){
 const releases=await tx.softwareRelease.findMany({where:{productId:license.productId}});
 releases.sort((a,b)=>versionGreater(a.version,b.version)?-1:versionGreater(b.version,a.version)?1:0);
 const release=releases[0];if(!release)throw new ApiError("Belum ada rilis",404);
 if(action==="download"){const asset=await tx.productAsset.findUnique({where:{id:release.assetId}});if(!asset||asset.productId!==license.productId)throw new ApiError("Berkas rilis tidak ditemukan",404);return {asset};}
 return {success:true,version:release.version,has_update:versionGreater(release.version,String(input.current_version||"0.0.0")),sha256:release.sha256,download_endpoint:(process.env.NEXT_PUBLIC_APP_URL||"")+"/api/download"};
 }
 return {success:true,status:"active",domain,expires_at:license.expiresAt};
 },PRISMA_SERIALIZABLE);}catch(e){if(isConflict(e)&&attempt<2)continue;throw e;}}
 throw new ApiError("Sistem sibuk",409);
}
