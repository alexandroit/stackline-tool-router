export type ToolFormat =
  | 'canonical'
  | 'mcp'
  | 'openai-chat'
  | 'openai-responses'
  | 'anthropic'
  | 'gemini';

export type ToolFormatInput = ToolFormat | 'auto';

export type JsonSchema = boolean | {
  [key: string]: unknown;
};

export interface CanonicalTool {
  id?: string;
  name: string;
  description?: string;
  namespace?: string;
  tags?: readonly string[];
  aliases?: readonly string[];
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  schema?: JsonSchema;
  [key: string]: unknown;
}

export interface NormalizedTool<T = unknown> {
  readonly aliases: readonly string[];
  readonly description: string;
  readonly format: ToolFormat;
  readonly id: string;
  readonly inputSchema: unknown;
  readonly name: string;
  readonly namespace: string;
  readonly original: T;
  readonly outputSchema: unknown;
  readonly tags: readonly string[];
}

export interface FieldWeights {
  aliases?: number;
  description?: number;
  name?: number;
  namespace?: number;
  schema?: number;
  tags?: number;
}

export interface ToolRouterOptions {
  b?: number;
  fieldWeights?: FieldWeights;
  format?: ToolFormatInput;
  fuzzy?: boolean;
  k1?: number;
  maxExpansions?: number;
  maxQueryLength?: number;
  maxSchemaDepth?: number;
  maxSchemaNodes?: number;
  maxTextLength?: number;
  maxTools?: number;
  minFuzzyLength?: number;
  onDuplicate?: 'error' | 'replace';
  synonyms?: false | {
    [word: string]: string | readonly string[];
  };
  tokenizer?(input: string): string[];
}

export interface ResolvedToolRouterOptions {
  readonly b: number;
  readonly fieldWeights: Readonly<Required<FieldWeights>>;
  readonly format?: ToolFormatInput;
  readonly fuzzy: boolean;
  readonly k1: number;
  readonly maxExpansions: number;
  readonly maxQueryLength: number;
  readonly maxSchemaDepth: number;
  readonly maxSchemaNodes: number;
  readonly maxTextLength: number;
  readonly maxTools: number;
  readonly minFuzzyLength: number;
  readonly onDuplicate: 'error' | 'replace';
  readonly synonyms: Readonly<Record<string, readonly string[]>>;
  readonly tokenizer: (input: string) => string[];
}

export interface ToolSearchOptions<T = unknown> {
  filter?(record: NormalizedTool<T>): boolean;
  formats?: string | readonly string[];
  ids?: string | readonly string[];
  limit?: number;
  maxEstimatedTokens?: number;
  minScore?: number;
  namespaces?: string | readonly string[];
  tags?: string | readonly string[];
}

export interface ToolRouteOptions<T = unknown> extends ToolSearchOptions<T> {
  fallback?: 'none' | 'first' | 'all';
  maxTools?: number;
  pinned?: string | readonly string[];
}

export interface ToolMatch<T = unknown> {
  readonly estimatedTokens: number;
  readonly id: string;
  readonly matchedFields: readonly string[];
  readonly matchedTerms: readonly string[];
  readonly name: string;
  readonly pinned: boolean;
  readonly queryCoverage: number;
  readonly record: NormalizedTool<T>;
  readonly score: number | null;
  readonly tool: T;
}

export interface ToolRouteResult<T = unknown> {
  readonly budgetExceeded: boolean;
  readonly catalogEstimatedTokens: number;
  readonly catalogSize: number;
  readonly estimatedTokens: number;
  readonly matches: readonly ToolMatch<T>[];
  readonly records: readonly NormalizedTool<T>[];
  readonly selectedCount: number;
  readonly tokenReduction: number;
  readonly tools: readonly T[];
}

export interface ToolRouterStats {
  readonly estimatedTokens: number;
  readonly fields: Readonly<Record<string, number>>;
  readonly terms: number;
  readonly tools: number;
}

export type ToolCatalog<T> =
  | readonly T[]
  | { tools: readonly T[] }
  | { functionDeclarations: readonly T[] };

export class ToolRouterError extends Error {
  constructor(code: string, message: string, details?: unknown);
  readonly code: string;
  readonly details?: unknown;
}

export class ToolRouter<T = unknown> {
  constructor(tools?: ToolCatalog<T>, options?: ToolRouterOptions);
  readonly size: number;
  readonly options: ResolvedToolRouterOptions;
  add(tools: T | ToolCatalog<T>, options?: { format?: ToolFormatInput }): this;
  remove(ids: string | readonly string[]): number;
  replace(tools: ToolCatalog<T>, options?: { format?: ToolFormatInput }): this;
  clear(): this;
  has(idOrName: string): boolean;
  get(idOrName: string): NormalizedTool<T> | undefined;
  list(): NormalizedTool<T>[];
  stats(): ToolRouterStats;
  search(query: string, options?: ToolSearchOptions<T>): ToolMatch<T>[];
  select(query: string, options?: ToolSearchOptions<T>): T[];
  route(query: string, options?: ToolRouteOptions<T>): ToolRouteResult<T>;
}

export type ToolSearchTarget = ToolFormat;

export interface ToolSearchInput {
  query: string;
  limit?: number;
}

export interface ToolSearchSummary {
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly namespace?: string;
  readonly score: number | null;
  readonly tags: readonly string[];
}

export interface ToolSearchResult {
  readonly catalogSize: number;
  readonly query: string;
  readonly tools: readonly ToolSearchSummary[];
}

export interface ToolSearchHelper {
  readonly definition: unknown;
  execute(input: ToolSearchInput): ToolSearchResult;
}

export const TOOL_FORMATS: readonly ToolFormat[];

export function createToolRouter<T = unknown>(
  tools?: ToolCatalog<T>,
  options?: ToolRouterOptions
): ToolRouter<T>;

export function routeTools<T = unknown>(
  tools: ToolCatalog<T>,
  query: string,
  options?: ToolRouteOptions<T> & { router?: ToolRouterOptions }
): ToolRouteResult<T>;

export function createToolSearch<T = unknown>(
  router: ToolRouter<T>,
  options?: {
    target?: ToolSearchTarget;
    name?: string;
    description?: string;
    limit?: number;
  }
): ToolSearchHelper;

export function defineTool<T>(tool: T): T;
export function detectToolFormat(tool: unknown): ToolFormat;
export function normalizeTool<T = unknown>(
  tool: T,
  options?: { format?: ToolFormatInput }
): NormalizedTool<T>;
export function normalizeTools<T = unknown>(
  tools: ToolCatalog<T>,
  options?: { format?: ToolFormatInput; maxTools?: number }
): NormalizedTool<T>[];
export function estimateToolTokens(tool: unknown): number;
export function normalizeIdentifier(input: unknown): string;
export function normalizeText(input: unknown): string;
export function tokenize(input: unknown, options?: { maxTokenLength?: number }): string[];

declare const api: {
  TOOL_FORMATS: typeof TOOL_FORMATS;
  ToolRouter: typeof ToolRouter;
  ToolRouterError: typeof ToolRouterError;
  createToolRouter: typeof createToolRouter;
  createToolSearch: typeof createToolSearch;
  defineTool: typeof defineTool;
  detectToolFormat: typeof detectToolFormat;
  estimateToolTokens: typeof estimateToolTokens;
  normalizeIdentifier: typeof normalizeIdentifier;
  normalizeText: typeof normalizeText;
  normalizeTool: typeof normalizeTool;
  normalizeTools: typeof normalizeTools;
  routeTools: typeof routeTools;
  tokenize: typeof tokenize;
};

export default api;
