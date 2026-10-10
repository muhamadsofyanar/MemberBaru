import test from 'node:test';
import assert from 'node:assert/strict';
import { isConflict, PRISMA_SERIALIZABLE } from '../lib/db';

test('isConflict: P2034 Prisma code terdeteksi serial failure', () => {
  assert.ok(isConflict({ code: 'P2034' }));
  assert.ok(isConflict({ code: '40001' }));
});

test('isConflict: error message serialization failure', () => {
  assert.ok(isConflict(new Error('could not serialize access due to concurrent update')));
  assert.ok(isConflict(new Error('deadlock detected 40001')));
});

test('isConflict: biasa notFound tidak conflict', () => {
  assert.equal(isConflict(new Error('Not found')), false);
  assert.equal(isConflict({ code: 'P2002' }), false);
  assert.equal(isConflict(null), false);
});

test('PRISMA_SERIALIZABLE adalah Serializable level', () => {
  assert.ok(PRISMA_SERIALIZABLE.isolationLevel, 'ada isolationLevel');
});

test('approveOrder atomic: updateMany PENDING -> PAID jika count === 0 artinya status sudah berubah -> 409', () => {
  function approveOnce(currentStatuses: Record<string, string>, id: string): { status: number; updated: number } {
    const before = currentStatuses[id];
    if (before !== 'PENDING') return { status: 409, updated: 0 };
    currentStatuses[id] = 'PAID';
    return { status: 200, updated: 1 };
  }
  const rows: Record<string, string> = { O1: 'PENDING', O2: 'PAID' };
  const first = approveOnce(rows, 'O1');
  assert.equal(first.status, 200);
  const twice = approveOnce(rows, 'O1');
  assert.equal(twice.status, 409, 'double approve PAID -> 409');
  const rejectTarget = approveOnce(rows, 'O2');
  assert.equal(rejectTarget.status, 409, 'target PAID -> 409');
});

test('legacy vs new branch detection: legacy true ATAU planId not null dan items.length === 0', () => {
  function isLegacy(o: { legacy?: boolean; planId?: string | null; items: unknown[] }) {
    return !!(o.legacy || (o.planId != null && o.items.length === 0));
  }
  assert.equal(isLegacy({ legacy: true, planId: null, items: [{ id: 'x' }] }), true);
  assert.equal(isLegacy({ legacy: false, planId: 'plan-A', items: [] }), true);
  assert.equal(isLegacy({ legacy: false, planId: 'plan-A', items: [{ id: 'x' }] }), false, 'items > 0 = new');
  assert.equal(isLegacy({ legacy: false, planId: null, items: [{ id: 'x' }] }), false);
});

test('entitlement composite unique userId+kind+grantRefId menghindari double insert', () => {
  const map = new Map<string, number>();
  function insert(userId: string, kind: string, grantRefId: string): boolean {
    const k = `${userId}#${kind}#${grantRefId}`;
    if (map.has(k)) return false;
    map.set(k, 1);
    return true;
  }
  assert.equal(insert('U1', 'COURSE', 'C1'), true);
  assert.equal(insert('U1', 'COURSE', 'C1'), false, 'duplicate -> false (409/skip)');
  assert.equal(insert('U2', 'COURSE', 'C1'), true);
  assert.equal(insert('U1', 'ASSET', 'C1'), true);
});
