import { fail } from './errors.js';
import { isObject, ownEnumerableEntries } from './safe.js';

const TEXT_KEYS = new Set(['title', 'description', '$comment', 'format', 'pattern', 'const']);
const COLLECTION_KEYS = new Set(['enum', 'examples', 'required']);

export function collectSchemaText(schema, options = {}) {
  if (!isObject(schema) && typeof schema !== 'boolean') return '';
  const maxDepth = options.maxSchemaDepth === undefined ? 24 : options.maxSchemaDepth;
  const maxNodes = options.maxSchemaNodes === undefined ? 10_000 : options.maxSchemaNodes;
  const maxTextLength = options.maxTextLength === undefined ? 65_536 : options.maxTextLength;
  const seen = new WeakSet();
  const parts = [];
  let nodes = 0;
  let length = 0;

  function consumeNode() {
    nodes += 1;
    if (nodes > maxNodes) fail('ERR_TOOL_SCHEMA_SIZE', `Tool schema exceeds maxSchemaNodes (${maxNodes})`);
  }

  function append(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return;
    const text = String(value);
    if (text.length === 0 || length >= maxTextLength) return;
    const remaining = maxTextLength - length;
    const piece = text.slice(0, remaining);
    parts.push(piece);
    length += piece.length + 1;
  }

  function visit(value, depth, parentKey) {
    if (depth > maxDepth) fail('ERR_TOOL_SCHEMA_DEPTH', `Tool schema exceeds maxSchemaDepth (${maxDepth})`);
    consumeNode();
    if (!isObject(value)) return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      if (value.length > maxNodes - nodes) {
        fail('ERR_TOOL_SCHEMA_SIZE', `Tool schema exceeds maxSchemaNodes (${maxNodes})`);
      }
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) continue;
        if (COLLECTION_KEYS.has(parentKey)) {
          consumeNode();
          append(descriptor.value);
        }
        else visit(descriptor.value, depth + 1, parentKey);
      }
      return;
    }

    const entries = ownEnumerableEntries(value);
    if (entries.length > maxNodes - nodes) {
      fail('ERR_TOOL_SCHEMA_SIZE', `Tool schema exceeds maxSchemaNodes (${maxNodes})`);
    }
    for (const [key, child] of entries) {
      if (parentKey === 'properties' || parentKey === '$defs' || parentKey === 'definitions') append(key);
      if (TEXT_KEYS.has(key)) {
        consumeNode();
        append(child);
      }
      else if (COLLECTION_KEYS.has(key) && Array.isArray(child)) visit(child, depth + 1, key);
      else visit(child, depth + 1, key);
    }
  }

  visit(schema, 0, '');
  return parts.join(' ');
}

export function estimateJsonTokens(value, options = {}) {
  const maxDepth = options.maxDepth === undefined ? 64 : options.maxDepth;
  const maxNodes = options.maxNodes === undefined ? 100_000 : options.maxNodes;
  const seen = new WeakSet();
  let nodes = 0;

  function stringLength(text) {
    return JSON.stringify(text).length;
  }

  function measure(current, depth) {
    if (depth > maxDepth) fail('ERR_TOOL_VALUE_DEPTH', `Tool definition exceeds maxDepth (${maxDepth})`);
    nodes += 1;
    if (nodes > maxNodes) fail('ERR_TOOL_VALUE_SIZE', `Tool definition exceeds maxNodes (${maxNodes})`);
    if (current === null) return 4;
    if (typeof current === 'string') return stringLength(current);
    if (typeof current === 'number') return Number.isFinite(current) ? String(current).length : 4;
    if (typeof current === 'boolean') return current ? 4 : 5;
    if (typeof current === 'bigint') fail('ERR_TOOL_VALUE_TYPE', 'Tool definition cannot contain bigint values');
    if (typeof current === 'undefined' || typeof current === 'function' || typeof current === 'symbol') return 0;
    if (seen.has(current)) fail('ERR_TOOL_CYCLIC', 'Tool definition must be JSON-serializable');
    seen.add(current);

    let length = 2;
    let count = 0;
    if (Array.isArray(current)) {
      if (current.length > maxNodes - nodes) {
        fail('ERR_TOOL_VALUE_SIZE', `Tool definition exceeds maxNodes (${maxNodes})`);
      }
      for (let index = 0; index < current.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
        const child = descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
          ? descriptor.value
          : null;
        length += measure(child, depth + 1) + (count > 0 ? 1 : 0);
        count += 1;
      }
    } else {
      const entries = ownEnumerableEntries(current);
      if (entries.length > maxNodes - nodes) {
        fail('ERR_TOOL_VALUE_SIZE', `Tool definition exceeds maxNodes (${maxNodes})`);
      }
      for (const [key, child] of entries) {
        const measured = measure(child, depth + 1);
        if (measured === 0 && (child === undefined || typeof child === 'function' || typeof child === 'symbol')) continue;
        length += stringLength(key) + 1 + measured + (count > 0 ? 1 : 0);
        count += 1;
      }
    }
    seen.delete(current);
    return length;
  }

  return Math.max(1, Math.ceil(measure(value, 0) / 4));
}
