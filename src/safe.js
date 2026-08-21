import { fail } from './errors.js';

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function isUnsafeKey(key) {
  return typeof key === 'string' && UNSAFE_KEYS.has(key);
}

export function isObject(value) {
  return value !== null && typeof value === 'object';
}

export function ownValue(value, key) {
  if (!isObject(value) && typeof value !== 'function') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

export function ownEnumerableEntries(value) {
  if (!isObject(value)) return [];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = [];
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) continue;
    if (isUnsafeKey(key)) continue;
    entries.push([key, descriptor.value]);
  }
  return entries;
}

export function stringValue(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function stringList(value, limit = 256) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (let index = 0; index < value.length && result.length < limit; index++) {
    const item = ownValue(value, String(index));
    if (typeof item === 'string' && item.length > 0) result.push(item);
  }
  return result;
}

export function positiveInteger(value, fallback, maximum, label) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    fail('ERR_TOOL_ROUTER_OPTION', `${label} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

export function finiteNumber(value, fallback, minimum, maximum, label) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail('ERR_TOOL_ROUTER_OPTION', `${label} must be a finite number between ${minimum} and ${maximum}`);
  }
  return value;
}
