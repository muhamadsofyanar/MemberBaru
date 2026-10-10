import nodemailer from "nodemailer";
export function mailReady(){return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.NEXT_PUBLIC_APP_URL);}
export async function sendResetEmail(email:string, token:string){
 if(!mailReady())throw new Error("SMTP belum dikonfigurasi.");
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==="true",auth:process.env.SMTP_USER ? {user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:10000,socketTimeout:15000});
 const url=new URL("/reset-password",process.env.NEXT_PUBLIC_APP_URL);url.searchParams.set("token",token);
 await transport.sendMail({from:process.env.SMTP_FROM,to:email,subject:"Reset password RizqHub",text:`Gunakan tautan ini dalam 30 menit untuk mengganti password:
${url}

Abaikan email ini jika Anda tidak meminta reset password.`});
}
