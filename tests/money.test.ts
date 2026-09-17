import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, roundMoney } from '../lib/money';

test('parseMoney accepts valid pounds and pence', () => {
  assert.equal(parseMoney('12'), 12);
  assert.equal(parseMoney('12.5'), 12.5);
  assert.equal(parseMoney('12.50'), 12.5);
});

test('parseMoney rejects malformed or zero values', () => {
  assert.throws(() => parseMoney('12.345'));
  assert.throws(() => parseMoney('£12.50'));
  assert.throws(() => parseMoney('0'));
  assert.throws(() => parseMoney('-1'));
  assert.equal(parseMoney('0', { allowZero: true }), 0);
});

test('roundMoney works at the penny boundary', () => {
  assert.equal(roundMoney(10.005), 10.01);
  assert.equal(roundMoney(10.004), 10);
});
