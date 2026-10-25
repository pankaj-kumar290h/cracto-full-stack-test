import { GraphQLError } from 'graphql';
import { STEPS } from '../shared/release.js';

export const badInput = (message: string) => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
export const notFound = () => new GraphQLError('Release not found.', { extensions: { code: 'NOT_FOUND' } });

export function validateId(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw badInput('Choose a valid release ID.');
  }
  return id;
}

export function validateName(name: string): string {
  const result = name.trim();
  if (!result || result.length > 200) throw badInput('Release name must contain 1 to 200 characters.');
  return result;
}

export function validateInfo(info?: string | null): string | null {
  if (info && info.length > 10000) throw badInput('Additional information must be 10,000 characters or fewer.');
  return info?.trim() || null;
}

export function validateDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw badInput('Use a valid ISO 8601 date and time with a timezone.');
  }
  const date = new Date(value);
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!Number.isFinite(date.getTime()) || month < 1 || month > 12 || day < 1 || day > maxDay) {
    throw badInput('Use a valid calendar date and time.');
  }
  return date.toISOString();
}

export function validateStep(id: string): string {
  if (!STEPS.some((step) => step.id === id)) throw badInput('Unknown checklist step.');
  return id;
}
