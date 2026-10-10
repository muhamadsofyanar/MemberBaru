"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Field={name:string;label:string;type?:string;value?:string|number;required?:boolean;options?:{value:string;label:string}[]};
export function ActionForm({endpoint,method="POST",fields=[],extra={},label="Simpan",success="Berhasil disimpan.",redirect,confirmMessage}:{endpoint:string;method?:string;fields?:Field[];extra?:Record<string,unknown>;label?:string;success?:string;redirect?:string;confirmMessage?:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);const router=useRouter();
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(confirmMessage&&!window.confirm(confirmMessage))return;setBusy(true);setMessage("");try{
 const values=Object.fromEntries(new FormData(e.currentTarget));const res=await fetch(endpoint,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({...values,...extra})});
 const body=await res.json().catch(()=>({error:"Respons server tidak valid."}));if(!res.ok)throw new Error(body.error||"Permintaan gagal.");setFailed(false);setMessage(body.message||success);if(redirect)router.push(redirect);router.refresh();
 }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:"Koneksi gagal.");}finally{setBusy(false);}}
 return <form onSubmit={submit}>{fields.map(f=><div className="field" key={f.name}><label htmlFor={`${endpoint}-${f.name}`}>{f.label}</label>{f.options?<select id={`${endpoint}-${f.name}`} name={f.name} defaultValue={f.value} required={f.required}>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:f.type==="textarea"?<textarea id={`${endpoint}-${f.name}`} name={f.name} defaultValue={f.value} required={f.required} rows={4}/>:<input id={`${endpoint}-${f.name}`} name={f.name} type={f.type||"text"} defaultValue={f.value} required={f.required} autoComplete={f.type==="password"?(f.name==="currentPassword"?"current-password":"new-password"):undefined}/>}</div>)}{message&&<p role="status" className={failed?"alert alert-error":"alert alert-success"}>{message}</p>}<button className="btn btn-primary" disabled={busy}>{busy?"Memproses...":label}</button></form>;
}
