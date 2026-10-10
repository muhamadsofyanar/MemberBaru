import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePrivateStoragePath, savePrivateProductAsset, assertProductAssetType } from '../lib/file-store';

test('resolvePrivateStoragePath reject absolute path Windows dan Unix', () => {
  assert.throws(() => resolvePrivateStoragePath('/etc/passwd'), /tidak valid/);
  assert.throws(() => resolvePrivateStoragePath('C:\\Windows\\System32\\cmd.exe'), /tidak valid/);
  assert.throws(() => resolvePrivateStoragePath('\\\\server\\share'), /tidak valid/);
});

test('resolvePrivateStoragePath reject dot-dot traversal', () => {
  assert.throws(() => resolvePrivateStoragePath('../../.env'), /tidak valid/);
  assert.throws(() => resolvePrivateStoragePath('sub/../../.env'), /tidak valid/);
  assert.throws(() => resolvePrivateStoragePath('..'), /tidak valid/);
});

test('resolvePrivateStoragePath allow safe filename UUID + sub folder', () => {
  const safe = resolvePrivateStoragePath('product-assets/uuid-12345.bin');
  assert.ok(safe.includes('product-assets'));
  assert.ok(safe.includes('uuid-12345.bin'));
});

test('assertProductAssetType: PDF magic %PDF- OK', () => {
  const pdfBuffer = Buffer.from('%PDF-1.4 content and then more bytes to be safe');
  const meta = { originalName: 'ebook.pdf', mime: 'application/pdf', size: pdfBuffer.length };
  assert.doesNotThrow(() => assertProductAssetType(meta, pdfBuffer));
});

test('assertProductAssetType: ZIP magic P K 03 04 OK', () => {
  const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]);
  const meta = { originalName: 'tpl.zip', mime: 'application/zip', size: zipBuffer.length };
  assert.doesNotThrow(() => assertProductAssetType(meta, zipBuffer));
});

test('assertProductAssetType: tolak non PDF/ZIP > reject dengan pesan jelas', () => {
  const htmlBuffer = Buffer.from('<!DOCTYPE html><html><body>XSS</body></html>');
  assert.throws(() => assertProductAssetType({ originalName: 'file.pdf', mime: 'application/pdf', size: htmlBuffer.length }, htmlBuffer), /PDF tidak valid/);
  const jpg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
  assert.throws(() => assertProductAssetType({ originalName: 'arsip.zip', mime: 'application/zip', size: jpg.length }, jpg), /ZIP tidak valid/);
  const txt = Buffer.from('hello world');
  assert.throws(() => assertProductAssetType({ originalName: 'notes.txt', mime: 'text/plain', size: txt.length }, txt), /Tipe file tidak didukung/);
});

test('savePrivateProductAsset cap 50 MiB ditolak (size > MAX sebelum signature)', () => {
  const over = 50 * 1024 * 1024 + 1;
  const pdfHeader = Buffer.from('%PDF-1.4 test pdf ');
  const larger = Buffer.alloc(4096);
  pdfHeader.copy(larger, 0);
  const meta = { originalName: 'big.pdf', mime: 'application/pdf', size: over };
  assert.throws(() => savePrivateProductAsset(meta, larger), /maksimal 50 MiB/);
});
