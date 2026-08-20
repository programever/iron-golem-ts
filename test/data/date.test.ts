import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { format, getDateMonthsAgo, subDays } from '../../src/data/date';

describe('format', () => {
  it('zero-pads month and day', () => {
    assert.equal(format(new Date(2025, 0, 5), 'yyyy-MM-dd'), '2025-01-05');
  });
});

describe('subDays', () => {
  it('subtracts days without mutating the input', () => {
    const date = new Date(2025, 2, 1);
    assert.equal(format(subDays(date, 1), 'yyyy-MM-dd'), '2025-02-28');
    assert.equal(format(date, 'yyyy-MM-dd'), '2025-03-01');
  });
});

describe('getDateMonthsAgo', () => {
  it('moves the date backwards by whole months', () => {
    const now = new Date();
    const past = getDateMonthsAgo(3);
    assert.ok(past.getTime() < now.getTime());
  });
});
