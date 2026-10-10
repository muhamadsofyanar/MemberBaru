import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
const COOKIE="rizqhub_session";
function secret() {
 const value=process.env.AUTH_SECRET;
 if(process.env.NODE_ENV === "production" && (!value || value.length<32)) throw new Error("AUTH_SECRET must contain at least 32 characters.");
 return new TextEncoder().encode(value || "development-secret-change-this-now");
}
export async function createSession(userId:string) {
 const user=await db.user.findUniqueOrThrow({where:{id:userId}});
 if(!user.isActive) throw new Error("Account inactive");
 const token=await new SignJWT({userId,version:user.sessionVersion}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(secret());
 (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:604800});
}
export async function clearSession(){(await cookies()).delete(COOKIE);}
export async function getSessionUser(){
 const token=(await cookies()).get(COOKIE)?.value; if(!token)return null;
 let payload;
 try {payload=(await jwtVerify(token,secret(),{algorithms:["HS256"]})).payload;} catch{return null;}
 if(typeof payload.userId!=="string")return null;
 const user=await db.user.findUnique({where:{id:payload.userId}});
 return user?.isActive && user.sessionVersion===payload.version ? user : null;
}
export async function requireUser(){const user=await getSessionUser();if(!user)redirect("/login");return user;}
export async function requireAdmin(){const user=await requireUser();if(user.role!=="ADMIN")redirect("/dashboard");return user;}
