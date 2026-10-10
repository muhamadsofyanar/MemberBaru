import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RizqHub | Belajar, Bertumbuh, Berpenghasilan",
  description: "Platform membership, LMS, dan affiliate untuk bertumbuh bersama.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="id">
      <body>
        <header className="nav-wrap">
          <nav className="nav container">
            <Link href="/" className="brand"><span>R</span>RizqHub</Link>
            <div className="nav-links">
              <Link href="/#fitur">Fitur</Link><Link href="/products">Katalog</Link><Link href="/#paket">Paket</Link><Link href="/#faq">FAQ</Link>
            </div>
            <div className="nav-actions">
              {user ? <Link className="btn btn-primary btn-sm" href={user.role === "ADMIN" ? "/admin" : "/dashboard"}>Buka Dashboard</Link> : <><Link className="btn btn-ghost btn-sm" href="/login">Masuk</Link><Link className="btn btn-primary btn-sm" href="/register">Mulai Sekarang</Link></>}
            </div>
          </nav>
        </header>
        {children}
        <footer><div className="container footer-grid"><div><Link href="/" className="brand brand-light"><span>R</span>RizqHub</Link><p>Belajar terarah, bertumbuh bersama, dan bangun penghasilan secara etis.</p></div><div><b>Platform</b><Link href="/#fitur">Membership</Link><Link href="/products">Katalog Produk</Link><Link href="/#fitur">LMS</Link><Link href="/#fitur">Affiliate</Link></div><div><b>Bantuan</b><Link href="/#faq">Pertanyaan Umum</Link><a href="mailto:hello@rizqhub.id">hello@rizqhub.id</a></div></div><div className="container copyright">© 2026 RizqHub. Seluruh hak dilindungi.</div></footer>
      </body>
    </html>
  );
}
