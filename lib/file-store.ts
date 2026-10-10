import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

export type FileAssetMeta = {
  originalName: string;
  mime: string;
  size: number;
};

const MAX_SIZE = 50 * 1024 * 1024; // 50 MiB

function pdfSignatureOk(buf: Buffer): boolean {
  return buf.length >= 5 && buf.slice(0, 5).toString("ascii") === "%PDF-";
}

function zipSignatureOk(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
    (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  );
}

export function assertProductAssetType(meta: FileAssetMeta, buffer: Buffer): void {
  if (meta.size > MAX_SIZE) {
    throw new Error("Ukuran file maksimal 50 MiB");
  }
  if (meta.size <= 0) {
    throw new Error("File kosong tidak diizinkan");
  }
  const mime = (meta.mime || "").toLowerCase();
  const name = (meta.originalName || "").toLowerCase();
  const pdf =
    mime === "application/pdf" ||
    name.endsWith(".pdf");
  const zip =
    mime === "application/zip" ||
    mime === "application/x-zip-compressed" ||
    mime === "application/octet-stream" && name.endsWith(".zip") ||
    name.endsWith(".zip");
  if (!pdf && !zip) {
    throw new Error("Tipe file tidak didukung. Gunakan PDF atau ZIP.");
  }
  if (pdf && !pdfSignatureOk(buffer)) {
    throw new Error("File PDF tidak valid (signature mismatch).");
  }
  if (zip && !zipSignatureOk(buffer)) {
    throw new Error("File ZIP tidak valid (signature mismatch).");
  }
}

export function privateStorageRoot(): string {
  const raw = process.env.PRIVATE_STORAGE_DIR || "./storage/private";
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(process.cwd(), raw);
}

export function ensurePrivateStorageDir(): string {
  const root = privateStorageRoot();
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, "product-assets"), { recursive: true });
  return root;
}

export type SavedAsset = {
  storageKey: string;
  size: number;
};

export function savePrivateProductAsset(
  meta: FileAssetMeta,
  buffer: Buffer,
): SavedAsset {
  assertProductAssetType(meta, buffer);
  const root = ensurePrivateStorageDir();
  const subdir = path.join(root, "product-assets");
  const id = crypto.randomUUID();
  const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
  const key = `product-assets/${yyyymm}/${id}${path.extname(meta.originalName) || ".bin"}`;
  const filePath = path.join(root, key);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return { storageKey: key, size: buffer.length };
}

export function resolvePrivateStoragePath(storageKey: string): string {
  if (!storageKey || storageKey.includes("..") || path.isAbsolute(storageKey) || path.win32.isAbsolute(storageKey) || storageKey.includes("\\")) {
    throw new Error("Storage key tidak valid");
  }
  const root = privateStorageRoot();
  return path.normalize(path.join(root, storageKey));
}

export function readPrivateAssetBuffer(storageKey: string): { buffer: Buffer; exists: boolean } {
  try {
    const filePath = resolvePrivateStoragePath(storageKey);
    return { buffer: fs.readFileSync(filePath), exists: true };
  } catch (err: any) {
    if (err && (err.code === "ENOENT" || err.code === "EISDIR")) {
      return { buffer: Buffer.alloc(0), exists: false };
    }
    throw err;
  }
}
