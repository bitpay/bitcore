import { Response } from 'express';
import logger from '../logger';
import { CacheStorage } from '../models/cache';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,20}$/;
const BROWSER_CACHE_SECONDS = 300;

export type ParamType = 'identifier' | 'chain' | 'date' | 'int' | 'number' | 'numberList';

export interface ParamRule {
  type: ParamType;
  required?: boolean;
  default?: string | number;
  max?: number;
}

/** Either the parse failed with a reason, or it produced values — never both. */
export type ParseResult<T> = { error: string; values?: undefined } | { error?: undefined; values: T };

/**
 * Validates the query params named in the spec and returns them typed, ignoring
 * anything else the caller sent. Every value is checked for being a plain string
 * first: express turns repeated and bracketed params into arrays and objects,
 * and those would otherwise reach mongo as query operators.
 */
export function parseParams<T = Record<string, any>>(query: any, spec: Record<string, ParamRule>): ParseResult<T> {
  const values: Record<string, any> = {};

  for (const [name, rule] of Object.entries(spec)) {
    const raw = (query || {})[name];
    if (raw === undefined) {
      if (rule.required) {
        return { error: `Missing required param ${name}` };
      }
      if (rule.default !== undefined) {
        values[name] = rule.default;
      }
      continue;
    }
    if (typeof raw !== 'string') {
      return { error: `Invalid ${name}` };
    }
    const parsed = parseValue(name, raw, rule);
    if (parsed.error) {
      return { error: parsed.error };
    }
    values[name] = parsed.value;
  }
  return { values: values as T };
}

function parseValue(name: string, raw: string, rule: ParamRule): { value?: any; error?: string } {
  switch (rule.type) {
    case 'identifier':
      if (!IDENTIFIER.test(raw)) {
        return { error: `Invalid ${name}` };
      }
      return { value: raw };
    // The collector stores chains uppercase, so callers may send either case.
    case 'chain':
      if (!IDENTIFIER.test(raw)) {
        return { error: `Invalid ${name}` };
      }
      return { value: raw.toUpperCase() };
    case 'date':
      if (!DATE.test(raw) || !isRealDate(raw)) {
        return { error: `Invalid ${name} date, expected YYYY-MM-DD` };
      }
      return { value: raw };
    case 'int': {
      if (!/^\d+$/.test(raw)) {
        return { error: `Invalid ${name}, expected a positive integer` };
      }
      const value = Number(raw);
      if (value < 1 || (rule.max !== undefined && value > rule.max)) {
        return { error: `Invalid ${name}, expected 1 to ${rule.max}` };
      }
      return { value };
    }
    case 'number': {
      const value = Number(raw);
      if (!isPositiveFinite(value)) {
        return { error: `Invalid ${name}, expected a positive number` };
      }
      return { value };
    }
    case 'numberList': {
      const parts = raw.split(',').filter(part => part !== '');
      if (!parts.length) {
        return { error: `Invalid ${name}, expected comma separated positive numbers` };
      }
      const value = parts.map(Number);
      if (!value.every(isPositiveFinite)) {
        return { error: `Invalid ${name}, expected comma separated positive numbers` };
      }
      return { value };
    }
  }
}

/**
 * A well formed YYYY-MM-DD can still be a day that never happened (2026-02-30).
 * Round-trip the components through a UTC date to catch those; UTC throughout so
 * the answer does not depend on where the node runs.
 */
function isRealDate(raw: string) {
  const [year, month, day] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

/** Stable cache key for an endpoint and the params it was called with. */
export function cacheKeyFor(endpoint: string, values: Record<string, any>): string {
  const parts = Object.keys(values)
    .sort()
    .map(key => `${key}=${values[key]}`);
  return `walletstats-${endpoint}-${parts.join('|')}`;
}

/**
 * Wallet stats responses are authenticated, so they must never land in a shared
 * cache. Set this on every response, including errors, to override the global
 * s-maxage that CacheMiddleware puts on everything.
 */
export function setPrivateCache(res: Response) {
  res.setHeader('Cache-Control', `private, max-age=${BROWSER_CACHE_SECONDS}`);
}

/** Serves a cached payload, computing it on a miss, and turns failures into a 500. */
export async function respondCached<T>(res: Response, cacheKey: string, ttl: number, onMiss: () => Promise<T>) {
  try {
    const data = await CacheStorage.getGlobalOrRefresh(cacheKey, onMiss, ttl);
    return res.json(data);
  } catch (err: any) {
    logger.error('Error serving %o: %o', cacheKey, err.stack || err.message || err);
    return res.status(500).json({ error: 'Error getting wallet stats' });
  }
}
