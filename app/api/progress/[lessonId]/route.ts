import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function allowed(userId: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({
    where: {
      id: lessonId,
      module: { course: { isPublished: true } },
      OR: [
        { isPreview: true },
        { module: { course: { plans: { some: { memberships: { some: { userId, status: "ACTIVE", startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } } } } } } },
      ],
    },
  });

  return Boolean(lesson);
}

export async function POST(
  _: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const user = await requireUser();
  const { lessonId } = await params;

  if (!(await allowed(user.id, lessonId))) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    update: { completedAt: new Date() },
    create: { userId: user.id, lessonId },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const user = await requireUser();
  const { lessonId } = await params;

  await db.lessonProgress.deleteMany({
    where: { userId: user.id, lessonId },
  });

  return NextResponse.json({ ok: true });
}
