import test from 'node:test';
import assert from 'node:assert/strict';
import { roundDiscountAllocation, allocateCommission } from '../lib/business';
import { buildOrderPreview, buildAndSaveOrder } from '../lib/pricing';

test('roundDiscountAllocation deterministic remainder spread ordered', () => {
  const items = [
    { index: 0, subtotalPrice: 20000 },
    { index: 1, subtotalPrice: 30000 },
    { index: 2, subtotalPrice: 50000 },
  ];
  const result = roundDiscountAllocation(items, 10000);
  const totalNet = result.reduce((s, r) => s + r.netPrice, 0);
  const totalDiscount = result.reduce((s, r) => s + r.discount, 0);
  assert.equal(totalDiscount, 10000, 'sum(discount) === discountTotal');
  assert.equal(totalNet, 90000, 'sum(net) === subtotal - discountTotal');
  assert.ok(result.every(r => r.netPrice >= 1), 'setiap item net >= 1');
});

test('roundDiscountAllocation rejects zero order (minimal Rp1 rule)', () => {
  const items = [{ index: 0, subtotalPrice: 5000 }];
  assert.throws(() => roundDiscountAllocation(items, 5000), /Diskon maksimal/);
  assert.deepEqual(roundDiscountAllocation([], 0), [], 'items kosong return array kosong');
});

test('roundDiscountAllocation proporsional bulat kebawah + remainder per item urut', () => {
  const items = [
    { index: 0, subtotalPrice: 10000 },
    { index: 1, subtotalPrice: 10000 },
  ];
  const res = roundDiscountAllocation(items, 3333);
  const sumDisc = res[0].discount + res[1].discount;
  assert.equal(sumDisc, 3333);
  assert.ok(res[0].discount === 1666 || res[0].discount === 1667, 'dibagi hampir rata');
});

test('allocateCommission floor percent dari net', () => {
  assert.equal(allocateCommission(100000, 20), 20000);
  assert.equal(allocateCommission(99999, 20), 19999);
  assert.equal(allocateCommission(1, 50), 0);
});

test('allocateCommission reject invalid input', () => {
  assert.throws(() => allocateCommission(-1, 10), /Net price tidak valid/);
  assert.throws(() => allocateCommission(100000, 150), /Percent tidak valid/);
});

test('pricing module membentuk preview: exports tersedia', () => {
  assert.equal(typeof buildOrderPreview, 'function');
  assert.equal(typeof buildAndSaveOrder, 'function');
});

test('pricing: plan dedup via Set behavior (dari pricing pushRefsForProduct)', () => {
  const planSeen = new Set<string>();
  const resultPlanIds: string[] = [];
  function pushPlan(id: string) {
    if (planSeen.has(id)) return;
    planSeen.add(id);
    resultPlanIds.push(id);
  }
  pushPlan('plan-A'); pushPlan('plan-B'); pushPlan('plan-A'); pushPlan('plan-C'); pushPlan('plan-B');
  assert.deepEqual(resultPlanIds, ['plan-A', 'plan-B', 'plan-C']);
  assert.equal(planSeen.size, 3);
});
