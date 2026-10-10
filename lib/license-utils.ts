export function normalizeDomain(value:string){
 let url:URL;try{url=new URL(value.includes("://")?value:`https://${value}`);}catch{throw new Error("Domain tidak valid");}
 const host=url.hostname.toLowerCase();
 if(!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(host)||host.includes(".."))throw new Error("Domain tidak valid");return host;
}
export function versionGreater(a:string,b:string){
 if(!/^\d+\.\d+\.\d+$/.test(b))return true;
 const x=a.split(".").map(Number),y=b.split(".").map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;
}
