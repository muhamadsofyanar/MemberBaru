"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type AuthFormProps = {
  mode: "login" | "register";
  refCode?: string;
  planSlug?: string;
};

export function AuthForm({ mode, refCode = "", planSlug = "" }: AuthFormProps) {
  const router = useRouter();
  const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError("");
    try {
    const data=Object.fromEntries(new FormData(e.currentTarget));
    const res=await fetch(`/api/auth/${mode}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const body=await res.json(); setLoading(false);
    if(!res.ok){setError(body.error||"Terjadi kesalahan.");return}
    router.push(body.redirect || "/dashboard"); router.refresh();
    } catch {setError("Koneksi gagal. Silakan coba lagi.");} finally {setLoading(false);}
  }
  return <form onSubmit={submit}>{error&&<div className="alert alert-error">{error}</div>}
    {mode==="register"&&<><div className="field"><label>Nama lengkap</label><input name="name" required minLength={3} placeholder="Nama Anda"/></div><div className="field"><label>Nomor WhatsApp</label><input name="phone" required placeholder="62812..."/></div></>}
    <div className="field"><label>Email</label><input name="email" type="email" required placeholder="nama@email.com"/></div>
    <div className="field"><label>Password</label><input name="password" type="password" required minLength={8} placeholder="Minimal 8 karakter"/></div>
    {mode==="register"&&<input type="hidden" name="ref" value={refCode}/>} 
    {mode==="register"&&<input type="hidden" name="plan" value={planSlug}/>} 
    <button className="btn btn-primary btn-block" disabled={loading}>{loading?"Memproses...":mode==="login"?"Masuk ke Dashboard":"Buat Akun Gratis"}</button>
  </form>
}
