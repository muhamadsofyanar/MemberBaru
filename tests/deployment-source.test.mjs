import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("progress access helper returns a boolean", () => {
  const source = read("app/api/progress/[lessonId]/route.ts");
  assert.match(source, /return Boolean\(lesson\);/);
});

test("runtime image contains the Prisma CLI used at startup", () => {
  const source = read("Dockerfile");
  assert.match(
    source,
    /COPY --from=builder --chown=nextjs:nodejs \/app\/node_modules \.\/node_modules/
  );
  assert.match(source, /\.\/node_modules\/\.bin\/prisma db push/);
  assert.match(source, /exec node server\.js/);
  assert.doesNotMatch(source, /db push && node scripts\/maintenance\.mjs/);
});

test("Coolify compose exposes the app internally and persists private files", () => {
  const source = read("docker-compose.yml");
  assert.match(source, /expose:\s*\n\s*- "8000"/);
  assert.doesNotMatch(source, /- "8000:8000"/);
  assert.match(source, /private_storage:\/data/);
  assert.match(source, /PRIVATE_STORAGE_DIR: \/data\/private/);
});

test("builder creates the public directory when Git omits the empty folder", () => {
  const source = read("Dockerfile");
  assert.match(source, /RUN mkdir -p public && npm run build/);
});

test("authentication pages do not rely on useSearchParams during prerender", () => {
  const form = read("components/AuthForm.tsx");
  assert.doesNotMatch(form, /useSearchParams/);
});

test("database-backed routes are explicitly rendered at request time", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /export const dynamic = "force-dynamic";/);
});
