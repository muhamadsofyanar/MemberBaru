import {ActionForm} from "@/components/ActionForm";
import { db } from "@/lib/db";
import { dateID } from "@/lib/utils";

export default async function Members() {
  const members = await db.user.findMany({ where: { role: "MEMBER" }, include: { memberships: { where: { status: "ACTIVE", startsAt: {lte: new Date()}, endsAt: { gt: new Date() } }, include: { plan: true }, orderBy: { endsAt: "desc" }, take: 1 }, _count: { select: { referrals: true } } }, orderBy: { createdAt: "desc" } });
  return <><div className="page-head"><div><h1>Data Member</h1><p>Daftar akun, membership aktif, dan referral.</p></div></div><div className="panel table-wrap"><table className="table"><thead><tr><th>Member</th><th>Kontak</th><th>Paket Aktif</th><th>Referral</th><th>Bergabung</th><th>Status akun</th></tr></thead><tbody>{members.map(m => <tr key={m.id}><td><b>{m.name}</b><br/><small>{m.referralCode}</small></td><td>{m.email}<br/><small>{m.phone || "-"}</small></td><td>{m.memberships[0]?.plan.name || "Belum aktif"}</td><td>{m._count.referrals}</td><td>{dateID(m.createdAt)}</td><td><ActionForm endpoint={`/api/admin/members/${m.id}`} method="PATCH" extra={{isActive:!m.isActive}} label={m.isActive?"Nonaktifkan":"Aktifkan"} confirmMessage={m.isActive?"Nonaktifkan akun ini? Sesi login akan berakhir.":undefined}/></td></tr>)}</tbody></table></div></>;
}
