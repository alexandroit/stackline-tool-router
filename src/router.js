import { normalizeTool, normalizeTools } from './adapters.js';
import { fail } from './errors.js';
import { collectSchemaText, estimateJsonTokens } from './schema.js';
import {
  finiteNumber,
  isObject,
  ownEnumerableEntries,
  ownValue,
  positiveInteger,
  stringList
} from './safe.js';
import {
  boundedEditDistance,
  normalizeIdentifier,
  tokenTrigrams,
  tokenize
} from './tokenize.js';

const FIELD_NAMES = Object.freeze(['name', 'namespace', 'aliases', 'tags', 'description', 'schema']);
const DEFAULT_WEIGHTS = Object.freeze({
  aliases: 7,
  description: 2,
  name: 10,
  namespace: 8,
  schema: 1,
  tags: 5
});
const DEFAULT_SYNONYM_GROUPS = Object.freeze([
  ['cancel', 'close', 'delete', 'remove'],
  ['create', 'add', 'make', 'new', 'open', 'schedule'],
  ['download', 'fetch', 'get', 'read', 'retrieve'],
  ['find', 'discover', 'look', 'lookup', 'query', 'search'],
  ['list', 'browse', 'show'],
  ['send', 'deliver', 'post', 'publish'],
  ['update', 'change', 'edit', 'modify', 'set'],
  ['available', 'availability', 'free'],
  ['conversation', 'conversations', 'message', 'messages'],
  ['document', 'documents', 'file', 'files', 'page', 'pages']
]);

function resolveWeights(input) {
  const weights = Object.create(null);
  for (const field of FIELD_NAMES) {
    const value = input && Object.prototype.hasOwnProperty.call(input, field)
      ? input[field]
      : DEFAULT_WEIGHTS[field];
    weights[field] = finiteNumber(value, DEFAULT_WEIGHTS[field], 0, 100, `fieldWeights.${field}`);
  }
  return Object.freeze(weights);
}

function resolveSynonyms(input) {
  if (input !== undefined && input !== false && !isObject(input)) {
    fail('ERR_TOOL_ROUTER_OPTION', 'synonyms must be false or an object of string arrays');
  }
  const synonyms = new Map();
  function connect(words) {
    const unique = Array.from(new Set(words.filter((word) => typeof word === 'string' && word.length > 1)));
    for (const word of unique) {
      let related = synonyms.get(word);
      if (!related) {
        related = new Set();
        synonyms.set(word, related);
      }
      for (const candidate of unique) if (candidate !== word) related.add(candidate);
    }
  }
  if (input !== false) for (const group of DEFAULT_SYNONYM_GROUPS) connect(group);
  if (isObject(input)) {
    for (const [word, values] of ownEnumerableEntries(input)) {
      const normalizedWord = tokenize(word)[0];
      if (!normalizedWord) continue;
      if (typeof values !== 'string' && !Array.isArray(values)) {
        fail('ERR_TOOL_ROUTER_OPTION', `synonyms.${word} must be a string or array of strings`);
      }
      const normalizedValues = [];
      for (const value of stringList(typeof values === 'string' ? [values] : values)) {
        normalizedValues.push(...tokenize(value));
      }
      connect([normalizedWord, ...normalizedValues]);
    }
  }
  const result = Object.create(null);
  for (const [word, related] of synonyms) result[word] = Object.freeze(Array.from(related));
  return Object.freeze(result);
}

function resolveOptions(options = {}) {
  if (options === null || typeof options !== 'object') {
    fail('ERR_TOOL_ROUTER_OPTION', 'Router options must be an object');
  }
  const tokenizer = options.tokenizer === undefined ? tokenize : options.tokenizer;
  if (typeof tokenizer !== 'function') fail('ERR_TOOL_ROUTER_OPTION', 'tokenizer must be a function');
  const onDuplicate = options.onDuplicate === undefined ? 'error' : options.onDuplicate;
  if (onDuplicate !== 'error' && onDuplicate !== 'replace') {
    fail('ERR_TOOL_ROUTER_OPTION', 'onDuplicate must be error or replace');
  }

  return Object.freeze({
    b: finiteNumber(options.b, 0.75, 0, 1, 'b'),
    fieldWeights: resolveWeights(options.fieldWeights),
    format: options.format,
    fuzzy: options.fuzzy === undefined ? true : Boolean(options.fuzzy),
    k1: finiteNumber(options.k1, 1.2, 0.1, 5, 'k1'),
    maxExpansions: positiveInteger(options.maxExpansions, 12, 100, 'maxExpansions'),
    maxQueryLength: positiveInteger(options.maxQueryLength, 4096, 65_536, 'maxQueryLength'),
    maxSchemaDepth: positiveInteger(options.maxSchemaDepth, 24, 256, 'maxSchemaDepth'),
    maxSchemaNodes: positiveInteger(options.maxSchemaNodes, 10_000, 1_000_000, 'maxSchemaNodes'),
    maxTextLength: positiveInteger(options.maxTextLength, 65_536, 1_000_000, 'maxTextLength'),
    maxTools: positiveInteger(options.maxTools, 100_000, 1_000_000, 'maxTools'),
    minFuzzyLength: positiveInteger(options.minFuzzyLength, 4, 32, 'minFuzzyLength'),
    onDuplicate,
    synonyms: resolveSynonyms(options.synonyms),
    tokenizer
  });
}

function countTokens(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

function nameSearchText(name) {
  return `${name} ${normalizeIdentifier(name)}`;
}

function nameAcronyms(name) {
  const words = tokenize(name).filter((word) => word.length > 0);
  const acronyms = new Set();
  if (words.length > 1) {
    acronyms.add(words.map((word) => Array.from(word)[0]).join(''));
    for (let start = 0; start < words.length - 1; start++) {
      for (let end = start + 2; end <= Math.min(words.length, start + 6); end++) {
        acronyms.add(words.slice(start, end).map((word) => Array.from(word)[0]).join(''));
      }
    }
  }
  return acronyms;
}

function queryAcronyms(query) {
  const acronyms = [];
  const matches = query.match(/\b[A-Z][A-Z0-9]{1,7}\b/g) || [];
  for (const match of matches) acronyms.push(`acr:${match.toLocaleLowerCase('en-US')}`);
  return acronyms;
}

function toSet(value) {
  if (value === undefined) return undefined;
  const list = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(list)) fail('ERR_TOOL_ROUTER_OPTION', 'Search filters must be strings or arrays of strings');
  return new Set(stringList(list, 10_000));
}

function compileFilters(options) {
  const ids = toSet(options.ids);
  const namespaces = toSet(options.namespaces);
  const formats = toSet(options.formats);
  const tags = toSet(options.tags);
  const filter = options.filter;
  if (filter !== undefined && typeof filter !== 'function') {
    fail('ERR_TOOL_ROUTER_OPTION', 'filter must be a function');
  }
  return (record) => {
    if (ids && !ids.has(record.id)) return false;
    if (namespaces && !namespaces.has(record.namespace)) return false;
    if (formats && !formats.has(record.format)) return false;
    if (tags) {
      for (const tag of tags) if (!record.tags.includes(tag)) return false;
    }
    return filter === undefined || Boolean(filter(record));
  };
}

function publicMatch(document, score, matchedTerms, matchedFields, queryCoverage, pinned = false) {
  return Object.freeze({
    estimatedTokens: document.estimatedTokens,
    id: document.record.id,
    matchedFields: Object.freeze(Array.from(matchedFields).sort()),
    matchedTerms: Object.freeze(Array.from(matchedTerms).sort()),
    name: document.record.name,
    pinned,
    queryCoverage,
    record: document.record,
    score: score === null ? null : Number(score.toFixed(6)),
    tool: document.record.original
  });
}

export class ToolRouter {
  constructor(tools = [], options = {}) {
    this._options = resolveOptions(options);
    this._documents = new Map();
    this._postings = new Map();
    this._prefixes = new Map();
    this._trigrams = new Map();
    this._fieldTotals = Object.create(null);
    for (const field of FIELD_NAMES) this._fieldTotals[field] = 0;
    this._estimatedTokens = 0;
    if (Array.isArray(tools) && tools.length === 0) return;
    this.add(tools);
  }

  get size() {
    return this._documents.size;
  }

  get options() {
    return this._options;
  }

  add(tools, options = {}) {
    const catalog = isObject(tools)
      && (Array.isArray(ownValue(tools, 'tools')) || Array.isArray(ownValue(tools, 'functionDeclarations')))
      ? tools
      : (Array.isArray(tools) ? tools : [tools]);
    const records = normalizeTools(catalog, {
      format: options.format === undefined ? this._options.format : options.format,
      maxTools: this._options.maxTools
    });
    const prepared = records.map((record) => this._prepare(record));
    const incoming = new Set();
    for (const document of prepared) {
      if (incoming.has(document.record.id)) {
        fail('ERR_TOOL_DUPLICATE', `Duplicate tool id in batch: ${document.record.id}`);
      }
      incoming.add(document.record.id);
      if (this._documents.has(document.record.id) && this._options.onDuplicate === 'error') {
        fail('ERR_TOOL_DUPLICATE', `Tool id already exists: ${document.record.id}`);
      }
    }
    let resultingSize = this._documents.size;
    for (const id of incoming) if (!this._documents.has(id)) resultingSize += 1;
    if (resultingSize > this._options.maxTools) {
      fail('ERR_TOOL_CATALOG_SIZE', `Tool catalog exceeds maxTools (${this._options.maxTools})`);
    }

    for (const document of prepared) {
      if (this._documents.has(document.record.id)) this._removeDocument(document.record.id);
      this._addDocument(document);
    }
    return this;
  }

  remove(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    let removed = 0;
    for (const id of list) {
      if (typeof id !== 'string') fail('ERR_TOOL_NAME', 'Tool id must be a string');
      const resolved = this._resolveDocument(id);
      if (resolved && this._removeDocument(resolved.record.id)) removed += 1;
    }
    return removed;
  }

  replace(tools, options = {}) {
    const fresh = new ToolRouter([], this._options);
    fresh.add(tools, options);
    this._documents = fresh._documents;
    this._postings = fresh._postings;
    this._prefixes = fresh._prefixes;
    this._trigrams = fresh._trigrams;
    this._fieldTotals = fresh._fieldTotals;
    this._estimatedTokens = fresh._estimatedTokens;
    return this;
  }

  clear() {
    this._documents.clear();
    this._postings.clear();
    this._prefixes.clear();
    this._trigrams.clear();
    for (const field of FIELD_NAMES) this._fieldTotals[field] = 0;
    this._estimatedTokens = 0;
    return this;
  }

  has(idOrName) {
    return Boolean(this._resolveDocument(idOrName));
  }

  get(idOrName) {
    const document = this._resolveDocument(idOrName);
    return document ? document.record : undefined;
  }

  list() {
    return Array.from(this._documents.values(), (document) => document.record);
  }

  stats() {
    return Object.freeze({
      estimatedTokens: this._estimatedTokens,
      fields: Object.freeze({ ...this._fieldTotals }),
      terms: this._postings.size,
      tools: this.size
    });
  }

  search(query, options = {}) {
    if (typeof query !== 'string') fail('ERR_TOOL_QUERY', 'Search query must be a string');
    if (query.length > this._options.maxQueryLength) {
      fail('ERR_TOOL_QUERY_SIZE', `Search query exceeds maxQueryLength (${this._options.maxQueryLength})`);
    }
    const limit = positiveInteger(options.limit, 5, 1000, 'limit');
    const minScore = finiteNumber(options.minScore, 0.01, 0, Number.MAX_SAFE_INTEGER, 'minScore');
    const queryTokens = this._tokenize(query).concat(queryAcronyms(query));
    if (queryTokens.length === 0 || this.size === 0) return [];
    const queryCounts = countTokens(queryTokens);
    const candidates = new Map();
    const matches = compileFilters(options);
    const filterCache = new Map();

    for (const [queryToken, queryFrequency] of queryCounts) {
      const expansions = this._expand(queryToken);
      const tokenCandidates = new Map();
      for (const [term, expansionWeight] of expansions) {
        const posting = this._postings.get(term);
        if (!posting) continue;
        const documentFrequency = posting.size;
        const inverseFrequency = Math.log(1 + (this.size - documentFrequency + 0.5) / (documentFrequency + 0.5));
        for (const [id, frequencies] of posting) {
          const document = this._documents.get(id);
          if (!document) continue;
          let allowed = filterCache.get(id);
          if (allowed === undefined) {
            allowed = matches(document.record);
            filterCache.set(id, allowed);
          }
          if (!allowed) continue;
          let weightedFrequency = 0;
          const fields = [];
          for (const field of FIELD_NAMES) {
            const frequency = frequencies[field] || 0;
            if (frequency === 0 || this._options.fieldWeights[field] === 0) continue;
            const averageLength = this._fieldTotals[field] / Math.max(1, this.size);
            const normalization = 1 - this._options.b
              + this._options.b * (document.fieldLengths[field] / averageLength);
            weightedFrequency += this._options.fieldWeights[field] * frequency / normalization;
            fields.push(field);
          }
          if (weightedFrequency === 0) continue;
          const saturation = weightedFrequency * (this._options.k1 + 1)
            / (weightedFrequency + this._options.k1);
          const contribution = inverseFrequency * saturation * expansionWeight
            * (1 + Math.log(queryFrequency));
          let tokenState = tokenCandidates.get(id);
          if (!tokenState) {
            tokenState = { contribution: 0, fields: new Set(), terms: new Set() };
            tokenCandidates.set(id, tokenState);
          }
          if (contribution > tokenState.contribution) {
            tokenState.contribution = contribution;
            tokenState.fields = new Set(fields);
          } else if (contribution === tokenState.contribution) {
            for (const field of fields) tokenState.fields.add(field);
          }
          tokenState.terms.add(term);
        }
      }
      for (const [id, tokenState] of tokenCandidates) {
        let state = candidates.get(id);
        if (!state) {
          state = {
            fields: new Set(),
            queryTerms: new Set(),
            score: 0,
            terms: new Set()
          };
          candidates.set(id, state);
        }
        state.score += tokenState.contribution;
        state.queryTerms.add(queryToken);
        for (const term of tokenState.terms) state.terms.add(term);
        for (const field of tokenState.fields) state.fields.add(field);
      }
    }

    const normalizedQuery = normalizeIdentifier(query);
    const ranked = [];
    for (const [id, state] of candidates) {
      const document = this._documents.get(id);
      let score = state.score;
      if (normalizedQuery && document.identifiers.has(normalizedQuery)) score += 12;
      else if (normalizedQuery && document.identifiersText.includes(normalizedQuery)) score += 2;
      for (const queryToken of queryCounts.keys()) {
        if (document.nameTokens.has(queryToken)) score += 1.5;
        if (document.namespaceTokens.has(queryToken)) score += 2;
      }
      const coverage = state.queryTerms.size / queryCounts.size;
      score = score * (0.65 + 0.35 * coverage) + coverage;
      if (score < minScore) continue;
      ranked.push({ document, score, state, coverage });
    }

    ranked.sort((left, right) => right.score - left.score
      || left.document.record.name.localeCompare(right.document.record.name)
      || left.document.record.id.localeCompare(right.document.record.id));

    const results = [];
    let tokens = 0;
    const tokenBudget = options.maxEstimatedTokens === undefined
      ? Infinity
      : finiteNumber(options.maxEstimatedTokens, Infinity, 1, Number.MAX_SAFE_INTEGER, 'maxEstimatedTokens');
    for (const item of ranked) {
      if (results.length >= limit) break;
      if (tokens + item.document.estimatedTokens > tokenBudget) continue;
      results.push(publicMatch(
        item.document,
        item.score,
        item.state.terms,
        item.state.fields,
        Number(item.coverage.toFixed(6))
      ));
      tokens += item.document.estimatedTokens;
    }
    return results;
  }

  select(query, options = {}) {
    return this.search(query, options).map((match) => match.tool);
  }

  route(query, options = {}) {
    const maxTools = positiveInteger(options.maxTools, 5, 1000, 'maxTools');
    const tokenBudget = options.maxEstimatedTokens === undefined
      ? Infinity
      : finiteNumber(options.maxEstimatedTokens, Infinity, 1, Number.MAX_SAFE_INTEGER, 'maxEstimatedTokens');
    const selected = [];
    const selectedIds = new Set();
    let estimatedTokens = 0;
    let budgetExceeded = false;

    const pinned = options.pinned === undefined
      ? []
      : (typeof options.pinned === 'string' ? [options.pinned] : options.pinned);
    if (!Array.isArray(pinned)) fail('ERR_TOOL_ROUTER_OPTION', 'pinned must be a string or array of strings');
    for (const id of pinned) {
      if (selected.length >= maxTools) break;
      const document = this._resolveDocument(id);
      if (!document || selectedIds.has(document.record.id)) continue;
      selected.push(publicMatch(document, null, new Set(), new Set(), 0, true));
      selectedIds.add(document.record.id);
      estimatedTokens += document.estimatedTokens;
      if (estimatedTokens > tokenBudget) budgetExceeded = true;
    }

    const candidates = this.search(query, {
      ...options,
      limit: Math.min(1000, Math.max(maxTools, maxTools * 4)),
      maxEstimatedTokens: undefined
    });
    for (const match of candidates) {
      if (selected.length >= maxTools) break;
      if (selectedIds.has(match.id)) continue;
      if (estimatedTokens + match.estimatedTokens > tokenBudget) continue;
      selected.push(match);
      selectedIds.add(match.id);
      estimatedTokens += match.estimatedTokens;
    }

    const fallback = options.fallback === undefined ? 'none' : options.fallback;
    if (!['none', 'first', 'all'].includes(fallback)) {
      fail('ERR_TOOL_ROUTER_OPTION', 'fallback must be none, first, or all');
    }
    if (selected.length === 0 && fallback !== 'none') {
      const matches = compileFilters(options);
      const documents = Array.from(this._documents.values())
        .filter((document) => matches(document.record))
        .sort((left, right) => left.record.id.localeCompare(right.record.id));
      const fallbackLimit = fallback === 'first' ? 1 : maxTools;
      for (const document of documents) {
        if (selected.length >= fallbackLimit) break;
        if (estimatedTokens + document.estimatedTokens > tokenBudget) continue;
        selected.push(publicMatch(document, null, new Set(), new Set(), 0));
        selectedIds.add(document.record.id);
        estimatedTokens += document.estimatedTokens;
      }
    }

    const reduction = this._estimatedTokens === 0
      ? 0
      : Math.max(0, 1 - estimatedTokens / this._estimatedTokens);
    return Object.freeze({
      budgetExceeded,
      catalogEstimatedTokens: this._estimatedTokens,
      catalogSize: this.size,
      estimatedTokens,
      matches: Object.freeze(selected),
      records: Object.freeze(selected.map((match) => match.record)),
      selectedCount: selected.length,
      tokenReduction: Number(reduction.toFixed(6)),
      tools: Object.freeze(selected.map((match) => match.tool))
    });
  }

  _prepare(record) {
    const schemaText = collectSchemaText(record.inputSchema, this._options);
    const fields = {
      aliases: record.aliases.join(' '),
      description: record.description,
      name: nameSearchText(record.name),
      namespace: record.namespace,
      schema: schemaText,
      tags: record.tags.join(' ')
    };
    const fieldTokens = Object.create(null);
    const fieldLengths = Object.create(null);
    const identifiers = new Set([normalizeIdentifier(record.name)]);
    for (const alias of record.aliases) identifiers.add(normalizeIdentifier(alias));
    if (record.namespace) identifiers.add(normalizeIdentifier(`${record.namespace} ${record.name}`));
    identifiers.delete('');

    let textLength = 0;
    for (const field of FIELD_NAMES) {
      textLength += fields[field].length;
      if (fields[field].length > this._options.maxTextLength || textLength > this._options.maxTextLength * 2) {
        fail('ERR_TOOL_TEXT_SIZE', `Tool ${record.id} exceeds maxTextLength (${this._options.maxTextLength})`);
      }
      const tokens = this._tokenize(fields[field]);
      fieldTokens[field] = countTokens(tokens);
      fieldLengths[field] = tokens.length;
    }
    for (const acronym of nameAcronyms(record.name)) {
      const term = `acr:${acronym}`;
      fieldTokens.name.set(term, (fieldTokens.name.get(term) || 0) + 1);
      fieldLengths.name += 1;
    }

    return {
      estimatedTokens: estimateJsonTokens(record.original),
      fieldLengths,
      fieldTokens,
      identifiers,
      identifiersText: Array.from(identifiers).join(' '),
      nameTokens: new Set(this._tokenize(record.name)),
      namespaceTokens: new Set(this._tokenize(record.namespace)),
      record
    };
  }

  _tokenize(text) {
    const result = this._options.tokenizer(text);
    if (!Array.isArray(result)) fail('ERR_TOOL_TOKENIZER', 'tokenizer must return an array of strings');
    const tokens = [];
    for (const token of result) {
      if (typeof token !== 'string') fail('ERR_TOOL_TOKENIZER', 'tokenizer results must be strings');
      if (token.length > 0 && token.length <= 256) tokens.push(token);
    }
    return tokens;
  }

  _addDocument(document) {
    this._documents.set(document.record.id, document);
    this._estimatedTokens += document.estimatedTokens;
    for (const field of FIELD_NAMES) {
      this._fieldTotals[field] += document.fieldLengths[field];
      for (const [term, frequency] of document.fieldTokens[field]) {
        let posting = this._postings.get(term);
        const isNewTerm = !posting;
        if (!posting) {
          posting = new Map();
          this._postings.set(term, posting);
        }
        let frequencies = posting.get(document.record.id);
        if (!frequencies) {
          frequencies = Object.create(null);
          posting.set(document.record.id, frequencies);
        }
        frequencies[field] = frequency;
        if (isNewTerm) this._addLexiconTerm(term);
      }
    }
  }

  _removeDocument(id) {
    const document = this._documents.get(id);
    if (!document) return false;
    this._documents.delete(id);
    this._estimatedTokens -= document.estimatedTokens;
    for (const field of FIELD_NAMES) {
      this._fieldTotals[field] -= document.fieldLengths[field];
      for (const term of document.fieldTokens[field].keys()) {
        const posting = this._postings.get(term);
        if (!posting) continue;
        posting.delete(id);
        if (posting.size === 0) {
          this._postings.delete(term);
          this._removeLexiconTerm(term);
        }
      }
    }
    return true;
  }

  _addLexiconTerm(term) {
    const maximum = Math.min(8, term.length);
    for (let length = 2; length <= maximum; length++) {
      const prefix = term.slice(0, length);
      let terms = this._prefixes.get(prefix);
      if (!terms) {
        terms = new Set();
        this._prefixes.set(prefix, terms);
      }
      terms.add(term);
    }
    for (const trigram of new Set(tokenTrigrams(term))) {
      let terms = this._trigrams.get(trigram);
      if (!terms) {
        terms = new Set();
        this._trigrams.set(trigram, terms);
      }
      terms.add(term);
    }
  }

  _removeLexiconTerm(term) {
    const maximum = Math.min(8, term.length);
    for (let length = 2; length <= maximum; length++) {
      const prefix = term.slice(0, length);
      const terms = this._prefixes.get(prefix);
      if (!terms) continue;
      terms.delete(term);
      if (terms.size === 0) this._prefixes.delete(prefix);
    }
    for (const trigram of new Set(tokenTrigrams(term))) {
      const terms = this._trigrams.get(trigram);
      if (!terms) continue;
      terms.delete(term);
      if (terms.size === 0) this._trigrams.delete(trigram);
    }
  }

  _expand(queryToken) {
    const expanded = new Map();
    this._addLiteralExpansions(expanded, queryToken, 1);
    const synonyms = this._options.synonyms[queryToken];
    if (synonyms) {
      for (const synonym of synonyms) this._addLiteralExpansions(expanded, synonym, 0.72);
    }
    if (expanded.size > 0 || !this._options.fuzzy || queryToken.length < this._options.minFuzzyLength) {
      return new Map(Array.from(expanded)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, this._options.maxExpansions));
    }

    const queryTrigrams = new Set(tokenTrigrams(queryToken));
    const overlap = new Map();
    for (const trigram of queryTrigrams) {
      const terms = this._trigrams.get(trigram);
      if (!terms) continue;
      for (const term of terms) overlap.set(term, (overlap.get(term) || 0) + 1);
    }
    const candidates = [];
    const maximumDistance = queryToken.length <= 5 ? 1 : 2;
    for (const [term, shared] of overlap) {
      const termTrigrams = new Set(tokenTrigrams(term));
      const similarity = shared / (queryTrigrams.size + termTrigrams.size - shared);
      if (similarity < 0.25) continue;
      const distance = boundedEditDistance(queryToken, term, maximumDistance);
      if (distance > maximumDistance) continue;
      const editSimilarity = 1 - distance / Math.max(queryToken.length, term.length);
      candidates.push({ term, weight: 0.55 + 0.25 * editSimilarity, similarity });
    }
    candidates.sort((left, right) => right.similarity - left.similarity
      || right.weight - left.weight
      || left.term.localeCompare(right.term));
    for (const candidate of candidates.slice(0, this._options.maxExpansions)) {
      expanded.set(candidate.term, candidate.weight);
    }
    return expanded;
  }

  _addLiteralExpansions(expanded, token, weight) {
    if (this._postings.has(token)) expanded.set(token, Math.max(weight, expanded.get(token) || 0));
    if (token.length < 3) return;
    const prefix = token.slice(0, Math.min(8, token.length));
    const prefixTerms = this._prefixes.get(prefix);
    if (!prefixTerms) return;
    const ordered = Array.from(prefixTerms)
      .filter((term) => term.startsWith(token) && term !== token)
      .sort((left, right) => Math.abs(left.length - token.length) - Math.abs(right.length - token.length)
        || left.localeCompare(right));
    for (const term of ordered.slice(0, this._options.maxExpansions)) {
      expanded.set(term, Math.max(weight * 0.78, expanded.get(term) || 0));
    }
  }

  _resolveDocument(idOrName) {
    if (typeof idOrName !== 'string') return undefined;
    const exact = this._documents.get(idOrName);
    if (exact) return exact;
    let match;
    for (const document of this._documents.values()) {
      if (document.record.name !== idOrName) continue;
      if (!match || document.record.id.localeCompare(match.record.id) < 0) match = document;
    }
    return match;
  }
}

export function createToolRouter(tools = [], options = {}) {
  return new ToolRouter(tools, options);
}

export function routeTools(tools, query, options = {}) {
  const routerOptions = options.router || {};
  const routeOptions = { ...options };
  delete routeOptions.router;
  return createToolRouter(tools, routerOptions).route(query, routeOptions);
}

export function estimateToolTokens(tool) {
  return estimateJsonTokens(tool);
}

export function defineTool(tool) {
  return normalizeTool(tool).original;
}
