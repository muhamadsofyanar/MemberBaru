import bcrypt from "bcryptjs";
import {scryptSync,timingSafeEqual} from "node:crypto";
export async function verifyPassword(value:string,stored:string) {
 const match=/^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(stored);
 if(match){ const actual=scryptSync(value,match[1],64,{N:16384,r:8,p:1}); return timingSafeEqual(actual,Buffer.from(match[2],"hex")); }
 return bcrypt.compare(value,stored);
}
