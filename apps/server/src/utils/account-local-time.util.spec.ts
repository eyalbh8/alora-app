import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLocalClock,
  isDueHour,
  localDateDaysAgo,
} from './account-local-time.util';

describe('getLocalClock', () => {
  it('returns YYYY-MM-DD and hour for Asia/Nicosia', () => {
    // 2026-06-15 02:00 UTC = 05:00 Asia/Nicosia (EEST +3)
    const date = new Date('2026-06-15T02:00:00.000Z');
    const clock = getLocalClock(date, 'Asia/Nicosia');
    assert.equal(clock.localDate, '2026-06-15');
    assert.equal(clock.localHour, 5);
    assert.equal(clock.timeZone, 'Asia/Nicosia');
  });

  it('handles UTC midnight near day boundary in Nicosia winter', () => {
    // 2026-01-15 22:00 UTC = 2026-01-16 00:00 Asia/Nicosia (EET +2)
    const date = new Date('2026-01-15T22:00:00.000Z');
    const clock = getLocalClock(date, 'Asia/Nicosia');
    assert.equal(clock.localDate, '2026-01-16');
    assert.equal(clock.localHour, 0);
  });

  it('falls back gracefully for invalid zones', () => {
    const date = new Date('2026-06-15T12:00:00.000Z');
    const clock = getLocalClock(date, 'Not/AZone');
    assert.equal(clock.localDate, '2026-06-15');
    assert.equal(clock.localHour, 12);
    assert.equal(clock.timeZone, 'UTC');
  });
});

describe('isDueHour', () => {
  it('matches configured hour', () => {
    const date = new Date('2026-06-15T02:00:00.000Z'); // 5am Nicosia
    assert.equal(isDueHour(date, 'Asia/Nicosia', 5), true);
    assert.equal(isDueHour(date, 'Asia/Nicosia', 6), false);
  });
});

describe('localDateDaysAgo', () => {
  it('subtracts calendar days', () => {
    assert.equal(localDateDaysAgo('2026-06-15', 50), '2026-04-26');
    assert.equal(localDateDaysAgo('2026-03-01', 1), '2026-02-28');
  });
});
