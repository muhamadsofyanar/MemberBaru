import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Courses() {
  const user = await requireUser(), now = new Date();
  const memberships = await db.membership.findMany({ where: { userId: user.id, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } }, select: { planId: true } });
  const planIds = memberships.map(m => m.planId);
  const entitlementsCourseRefs = (await db.entitlement.findMany({
    where: { userId: user.id, kind: "COURSE" },
    select: { grantRefId: true },
  })).map(e => e.grantRefId);
  const courses = await db.course.findMany({
    where: { isPublished: true, OR: [{ plans: { some: { id: { in: planIds } } } }, { id: { in: entitlementsCourseRefs } }, { modules: { some: { lessons: { some: { isPreview: true } } } } }] },
    select: { id: true, slug: true, title: true, description: true, plans: { select: { id: true } }, modules: { select: { lessons: { select: { id: true, isPreview: true } } } } },
  });
  const progress = await db.lessonProgress.findMany({ where: { userId: user.id }, select: { lessonId: true } }), done = new Set(progress.map(p => p.lessonId));
  return <><div className="page-head"><div><h1>Kelas Saya</h1><p>Pelajari materi pratinjau, beli sebagai produk satuan, atau buka seluruh kelas dengan membership.</p></div></div><div className="course-grid">{courses.map(course => { const full = course.plans.some(plan => planIds.includes(plan.id)) || entitlementsCourseRefs.includes(course.id); const lessons = course.modules.flatMap(module => module.lessons), visible = full ? lessons : lessons.filter(lesson => lesson.isPreview), completed = visible.filter(lesson => done.has(lesson.id)).length, pct = visible.length ? Math.round(completed / visible.length * 100) : 0; return <article className="course-card" key={course.id}><div className="course-cover"><b>{course.title}</b></div><div className="course-body"><h3>{course.title}</h3><p>{course.description}</p><div className="progress"><span style={{ width: `${pct}%` }}/></div><p>{pct}% selesai • {full ? `${lessons.length} materi` : `${visible.length} pratinjau gratis`}</p><Link href={`/dashboard/courses/${course.slug}`} className="btn btn-primary btn-block">{full ? "Buka Kelas" : "Lihat Pratinjau"}</Link></div></article> })}</div>{!courses.length && <div className="panel empty"><h2>Belum ada kelas yang tersedia</h2><p>Aktifkan membership atau beli kursus satuan di <Link href="/products">katalog</Link>.</p><Link href="/products" className="btn btn-primary">Lihat Katalog</Link></div>}</>;
}
