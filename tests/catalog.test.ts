import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductInput, slugifyProduct, PRODUCT_ASSET_REQUIRED } from '../lib/catalog';

test('PRODUCT_ASSET_REQUIRED hanya EBOOK & TEMPLATE', () => {
  assert.ok(PRODUCT_ASSET_REQUIRED.has('EBOOK' as any));
  assert.ok(PRODUCT_ASSET_REQUIRED.has('TEMPLATE' as any));
  assert.ok(!PRODUCT_ASSET_REQUIRED.has('COURSE' as any));
  assert.ok(!PRODUCT_ASSET_REQUIRED.has('MEMBERSHIP' as any));
});

test('normalizeProductInput: EBOOK price < 1 TIDAK valid + nama/deskripsi kosong ERROR', () => {
  const r = normalizeProductInput({
    name: '',
    description: '',
    type: 'EBOOK',
    price: 0,
  });
  assert.ok(r.errors.some(e => /nama produk/i.test(e)), 'nama empty error');
  assert.ok(r.errors.some(e => /deskripsi/i.test(e)), 'deskripsi empty error');
  assert.ok(r.errors.some(e => /harga.*minimal Rp1/i.test(e)), 'harga minimal Rp1 error');
});

test('normalizeProductInput: harga valid, features dan faq non-array ERROR (null/undefined diabaikan)', () => {
  const r = normalizeProductInput({
    name: 'Produk Saya',
    description: 'Desk saya',
    type: 'EBOOK',
    price: 50000,
    affiliatePercent: 15,
    status: 'PUBLISHED',
    features: null,
    faq: undefined,
  });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.data.features, [], 'null features -> []');
  assert.deepEqual(r.data.faq, [], 'undefined faq -> []');
  assert.equal(r.data.affiliatePercent, 15);
  assert.equal(r.data.status, 'PUBLISHED');
});

test('normalizeProductInput: affiliatePercent clamp 0-100', () => {
  const r = normalizeProductInput({
    name: 'Produk', description: 'Desk', type: 'COURSE', price: 1000,
    affiliatePercent: 200,
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.data.affiliatePercent, 100);
  const r2 = normalizeProductInput({
    name: 'Produk', description: 'Desk', type: 'COURSE', price: 1000,
    affiliatePercent: -10,
  });
  assert.equal(r2.data.affiliatePercent, 0);
});

test('slugifyProduct: slug lowercase strip karakter non alfanumerik jadi dash + dedup dash (dengan seed deterministik)', () => {
  assert.equal(slugifyProduct('Produk  Digital!  Panduan #1 PDF', 'zccg'), 'produk-digital-panduan-1-pdf-zccg');
  assert.equal(slugifyProduct('   Hello   World   ', 'xxxx'), 'hello-world-xxxx');
  assert.equal(slugifyProduct('Kursus Membuat Kue (Premium Edition)', 'abcd') , 'kursus-membuat-kue-premium-edition-abcd');
});
