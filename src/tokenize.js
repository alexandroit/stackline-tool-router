import { fail } from './errors.js';

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const CAMEL_BOUNDARY = /([\p{Ll}\p{N}])([\p{Lu}])/gu;
const ACRONYM_BOUNDARY = /([\p{Lu}]+)([\p{Lu}][\p{Ll}])/gu;
const WORDS = /[\p{L}\p{N}]+/gu;
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u;

export function normalizeText(input) {
  if (typeof input !== 'string') return '';
  let value = input;
  if (typeof value.normalize === 'function') value = value.normalize('NFKD');
  return value
    .replace(COMBINING_MARKS, '')
    .replace(ACRONYM_BOUNDARY, '$1 $2')
    .replace(CAMEL_BOUNDARY, '$1 $2')
    .toLocaleLowerCase('en-US');
}

export function normalizeIdentifier(input) {
  return normalizeText(input).replace(/[^\p{L}\p{N}]+/gu, '');
}

export function tokenize(input, options = {}) {
  const maxTokenLength = options.maxTokenLength === undefined ? 64 : options.maxTokenLength;
  if (!Number.isInteger(maxTokenLength) || maxTokenLength < 2 || maxTokenLength > 256) {
    fail('ERR_TOOL_ROUTER_OPTION', 'maxTokenLength must be an integer between 2 and 256');
  }

  const normalized = normalizeText(input);
  const words = normalized.match(WORDS) || [];
  const tokens = [];
  for (const word of words) {
    const token = word.slice(0, maxTokenLength);
    if (token.length > 1 || CJK.test(token)) tokens.push(token);
    if (token.length > 2 && CJK.test(token)) {
      const characters = Array.from(token);
      for (let index = 0; index < characters.length - 1; index++) {
        tokens.push(`${characters[index]}${characters[index + 1]}`);
      }
    }
  }
  return tokens;
}

export function tokenTrigrams(token) {
  const characters = Array.from(`  ${token} `);
  const result = [];
  for (let index = 0; index <= characters.length - 3; index++) {
    result.push(characters.slice(index, index + 3).join(''));
  }
  return result;
}

export function boundedEditDistance(left, right, maximum) {
  const a = Array.from(left);
  const b = Array.from(right);
  if (Math.abs(a.length - b.length) > maximum) return maximum + 1;
  if (a.length === 0) return Math.min(b.length, maximum + 1);
  if (b.length === 0) return Math.min(a.length, maximum + 1);

  let previous = new Array(b.length + 1);
  for (let index = 0; index <= b.length; index++) previous[index] = index;

  for (let row = 1; row <= a.length; row++) {
    const current = new Array(b.length + 1);
    current[0] = row;
    let rowMinimum = current[0];
    for (let column = 1; column <= b.length; column++) {
      const substitution = previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1);
      const insertion = current[column - 1] + 1;
      const deletion = previous[column] + 1;
      current[column] = Math.min(substitution, insertion, deletion);
      rowMinimum = Math.min(rowMinimum, current[column]);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previous = current;
  }

  return previous[b.length];
}
