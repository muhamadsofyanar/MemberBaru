import test from 'node:test';
import assert from 'node:assert/strict';
import { membershipWindow, payoutTransition, passwordSchema } from '../lib/business';
test('same plan renewal queues after the existing end',()=>{
 const now=new Date('2026-01-01T00:00:00Z'); const previous=new Date('2026-02-01T00:00:00Z');
 const w=membershipWindow(now,30,previous); assert.equal(w.startsAt.toISOString(),previous.toISOString()); assert.equal(w.endsAt.toISOString(),'2026-03-03T00:00:00.000Z');
});
test('new or expired membership starts now',()=>{const now=new Date('2026-01-01T00:00:00Z');assert.equal(membershipWindow(now,1,new Date('2025-01-01')).endsAt.toISOString(),'2026-01-02T00:00:00.000Z')});
test('payout cannot skip approval or process twice',()=>{assert.equal(payoutTransition('PENDING','PAID'),false);assert.equal(payoutTransition('APPROVED','PAID'),true);assert.equal(payoutTransition('PAID','PAID'),false);assert.equal(payoutTransition('APPROVED','REJECTED'),true)});
test('password rules reject short and overlong bcrypt input',()=>{assert.equal(passwordSchema.safeParse('short').success,false);assert.equal(passwordSchema.safeParse('a'.repeat(73)).success,false);assert.equal(passwordSchema.safeParse('sufficient-password').success,true)});
