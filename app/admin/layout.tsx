import { requireAdmin } from "@/lib/auth"; import { AppShell } from "@/components/AppShell";
export default async function Layout({children}:{children:React.ReactNode}){await requireAdmin();return <AppShell admin>{children}</AppShell>}
