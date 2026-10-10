import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCourseInput, validateVideoUrl } from "../lib/lms-validation";

test("accepts supported YouTube and Vimeo embed URLs", () => {
  assert.equal(validateVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ"), true);
  assert.equal(validateVideoUrl("https://player.vimeo.com/video/123456"), true);
});

test("rejects unsafe and non-embed video URLs", () => {
  assert.equal(validateVideoUrl("javascript:alert(1)"), false);
  assert.equal(validateVideoUrl("https://youtube.com/watch?v=dQw4w9WgXcQ"), false);
  assert.equal(validateVideoUrl("https://example.com/embed/video"), false);
});

test("normalizes ordering from array order and keeps supplied IDs", () => {
  const result = normalizeCourseInput({
    title: "Kursus Aman",
    description: "Deskripsi kursus yang cukup panjang.",
    isPublished: true,
    planIds: ["plan-1"],
    modules: [{
      id: "module-1",
      title: "Modul Utama",
      lessons: [{ id: "lesson-1", title: "Materi", content: "Isi materi", durationMinutes: 8, videoUrl: "", isPreview: false }],
    }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.modules[0].position, 1);
  assert.equal(result.value.modules[0].lessons[0].position, 1);
  assert.equal(result.value.modules[0].lessons[0].id, "lesson-1");
});

test("rejects duplicate nested IDs", () => {
  const result = normalizeCourseInput({
    title: "Kursus Aman",
    description: "Deskripsi kursus yang cukup panjang.",
    planIds: [],
    modules: [
      { id: "same", title: "Modul Satu", lessons: [] },
      { id: "same", title: "Modul Dua", lessons: [] },
    ],
  });
  assert.deepEqual(result, { ok: false, error: "ID modul duplikat." });
});

test("rejects invalid lesson fields and unsupported video hosts", () => {
  const result = normalizeCourseInput({
    title: "Kursus Aman",
    description: "Deskripsi kursus yang cukup panjang.",
    planIds: [],
    modules: [{ title: "Modul", lessons: [{ title: "Materi", content: "Isi", durationMinutes: 0, videoUrl: "https://evil.test/embed/x" }] }],
  });
  assert.equal(result.ok, false);
});
