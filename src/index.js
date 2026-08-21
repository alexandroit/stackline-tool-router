import { TOOL_FORMATS, detectToolFormat, normalizeTool, normalizeTools } from './adapters.js';
import { ToolRouterError } from './errors.js';
import {
  ToolRouter,
  createToolRouter,
  defineTool,
  estimateToolTokens,
  routeTools
} from './router.js';
import { createToolSearch } from './search-tool.js';
import { normalizeIdentifier, normalizeText, tokenize } from './tokenize.js';

export {
  TOOL_FORMATS,
  ToolRouter,
  ToolRouterError,
  createToolRouter,
  createToolSearch,
  defineTool,
  detectToolFormat,
  estimateToolTokens,
  normalizeIdentifier,
  normalizeText,
  normalizeTool,
  normalizeTools,
  routeTools,
  tokenize
};

export default Object.freeze({
  TOOL_FORMATS,
  ToolRouter,
  ToolRouterError,
  createToolRouter,
  createToolSearch,
  defineTool,
  detectToolFormat,
  estimateToolTokens,
  normalizeIdentifier,
  normalizeText,
  normalizeTool,
  normalizeTools,
  routeTools,
  tokenize
});
