import { badInput, validateId } from './domain.js';

export function pageSize(first = 25): number {
  if (!Number.isInteger(first) || first < 1 || first > 100) throw badInput('Page size must be between 1 and 100.');
  return first;
}

export function encodeCursor(date: string, id: string): string {
  return Buffer.from(JSON.stringify([date, id])).toString('base64url');
}

export function decodeCursor(cursor: string): [string, string] {
  try {
    if (cursor.length > 512) throw new Error();
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string'
      || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::\d{2})?)$/.test(value[0])
      || !Number.isFinite(Date.parse(value[0]))) throw new Error();
    // Retain PostgreSQL microseconds: converting through Date would truncate them.
    return [value[0], validateId(value[1])];
  } catch {
    throw badInput('Invalid page cursor.');
  }
}
