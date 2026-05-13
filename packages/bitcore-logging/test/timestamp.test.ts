import { expect } from 'chai';
import { formatTimestamp, timestamp } from '../src/timestamp';

describe('formatTimestamp', () => {
  it('should format a date with year-month-day hours:minutes:seconds.ms', () => {
    const date = new Date(2026, 0, 15, 10, 30, 45, 123); // Jan 15, 2026 10:30:45.123
    const result = formatTimestamp(date);
    expect(result).to.match(/^2026-01-15 10:30:45\.123/);
  });

  it('should left-pad milliseconds to 3 digits', () => {
    const date = new Date(2026, 2, 5, 8, 5, 3, 7); // Mar 5, 2026 08:05:03.007
    const result = formatTimestamp(date);
    expect(result).to.match(/^2026-03-05 08:05:03\.007/);
  });

  it('should include timezone suffix', () => {
    const result = formatTimestamp(new Date());
    // Should end with a timezone abbreviation like EST, PST, UTC, etc.
    expect(result).to.match(/\s[A-Z]{2,5}$/);
  });
});

describe('timestamp', () => {
  it('should return a formatted timestamp string for the current time', () => {
    const result = timestamp();
    expect(result).to.be.a('string');
    // Should match the date format pattern
    expect(result).to.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
  });
});
