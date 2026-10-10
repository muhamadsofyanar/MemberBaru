import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeCourseInput } from "@/lib/lms-validation";

const conflictCodes = new Set(["P2002", "P2025", "P2034"]);
function conflict(error: unknown) { return !!error && typeof error === "object" && "code" in error && conflictCodes.has(String(error.code)); }
const conflictResponse = () => NextResponse.json({ error: "Data kursus telah berubah. Muat ulang halaman lalu coba lagi." }, { status: 409 });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  try {
    const parsed = normalizeCourseInput(await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const data = parsed.value;
    if (!data.updatedAt) return NextResponse.json({ error: "Versi kursus wajib disertakan. Muat ulang halaman." }, { status: 409 });
    if (await db.plan.count({ where: { id: { in: data.planIds } } }) !== data.planIds.length)
      return NextResponse.json({ error: "Satu atau lebih paket tidak ditemukan." }, { status: 409 });
    const outcome = await db.$transaction(async tx => {
      const existing = await tx.course.findUnique({ where: { id }, include: { modules: { include: { lessons: true } } } });
      if (!existing) return "missing" as const;
      if (existing.updatedAt.getTime() !== new Date(data.updatedAt!).getTime()) return "stale" as const;
      const moduleIds = new Set(existing.modules.map(module => module.id));
      const lessonIds = new Set(existing.modules.flatMap(module => module.lessons.map(lesson => lesson.id)));
      if (data.modules.some(module => module.id && !moduleIds.has(module.id)) || data.modules.some(module => module.lessons.some(lesson => lesson.id && !lessonIds.has(lesson.id)))) return "stale" as const;
      for (let i = 0; i < existing.modules.length; i++) {
        await tx.module.update({ where: { id: existing.modules[i].id }, data: { position: -(i + 1) } });
        for (let j = 0; j < existing.modules[i].lessons.length; j++) await tx.lesson.update({ where: { id: existing.modules[i].lessons[j].id }, data: { position: -(j + 1) } });
      }
      const keptModules: string[] = [], keptLessons: string[] = [];
      for (const module of data.modules) {
        const savedModule = module.id
          ? await tx.module.update({ where: { id: module.id }, data: { title: module.title, position: module.position } })
          : await tx.module.create({ data: { courseId: id, title: module.title, position: module.position } });
        keptModules.push(savedModule.id);
        for (const lesson of module.lessons) {
          const fields = { moduleId: savedModule.id, title: lesson.title, content: lesson.content, videoUrl: lesson.videoUrl, durationMinutes: lesson.durationMinutes, isPreview: lesson.isPreview, position: lesson.position };
          const savedLesson = lesson.id ? await tx.lesson.update({ where: { id: lesson.id }, data: fields }) : await tx.lesson.create({ data: fields });
          keptLessons.push(savedLesson.id);
        }
      }
      await tx.lesson.deleteMany({ where: { id: { in: [...lessonIds].filter(value => !keptLessons.includes(value)) } } });
      await tx.module.deleteMany({ where: { id: { in: [...moduleIds].filter(value => !keptModules.includes(value)) } } });
      const course = await tx.course.update({ where: { id }, data: { title: data.title, description: data.description, thumbnail: data.thumbnail, isPublished: data.isPublished, plans: { set: data.planIds.map(planId => ({ id: planId })) } }, select: { updatedAt: true } });
      return course.updatedAt;
    }, { isolationLevel: "Serializable" });
    if (outcome === "missing") return NextResponse.json({ error: "Kursus tidak ditemukan." }, { status: 404 });
    if (outcome === "stale") return conflictResponse();
    return NextResponse.json({ ok: true, updatedAt: outcome.toISOString() });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 });
    if (conflict(error)) return conflictResponse();
    console.error("Update course failed", error);
    return NextResponse.json({ error: "Perubahan kursus gagal disimpan." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  try {
    if (!await db.course.findUnique({ where: { id }, select: { id: true } })) return NextResponse.json({ error: "Kursus tidak ditemukan." }, { status: 404 });
    await db.course.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (conflict(error)) return conflictResponse();
    console.error("Delete course failed", error);
    return NextResponse.json({ error: "Kursus gagal dihapus." }, { status: 500 });
  }
}
