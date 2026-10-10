import { requireUser } from "@/lib/auth"; import { AppShell } from "@/components/AppShell";
export default async function Layout({children}:{children:React.ReactNode}){await requireUser();return <AppShell>{children}</AppShell>}
