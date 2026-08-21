import { fail } from './errors.js';
import { isObject, ownValue, positiveInteger, stringList, stringValue } from './safe.js';

export const TOOL_FORMATS = Object.freeze([
  'canonical',
  'mcp',
  'openai-chat',
  'openai-responses',
  'anthropic',
  'gemini'
]);

function explicitFormat(format) {
  if (format === undefined || format === 'auto') return undefined;
  if (!TOOL_FORMATS.includes(format)) {
    fail('ERR_TOOL_FORMAT', `Unsupported tool format: ${String(format)}`);
  }
  return format;
}

export function detectToolFormat(tool) {
  if (!isObject(tool)) fail('ERR_TOOL_DEFINITION', 'Tool definition must be an object');
  const type = ownValue(tool, 'type');
  const nestedFunction = ownValue(tool, 'function');
  if (type === 'function' && isObject(nestedFunction)) return 'openai-chat';
  if (type === 'function' && typeof ownValue(tool, 'name') === 'string') return 'openai-responses';
  if (ownValue(tool, 'input_schema') !== undefined) return 'anthropic';
  if (ownValue(tool, 'inputSchema') !== undefined) return 'mcp';
  if (ownValue(tool, 'parameters') !== undefined) return 'gemini';
  if (typeof ownValue(tool, 'name') === 'string') return 'canonical';
  fail('ERR_TOOL_FORMAT', 'Unable to detect the tool definition format');
}

function sourceForFormat(tool, format) {
  if (format === 'openai-chat') {
    const nested = ownValue(tool, 'function');
    if (!isObject(nested)) fail('ERR_TOOL_DEFINITION', 'OpenAI Chat tool.function must be an object');
    return nested;
  }
  return tool;
}

function schemaForFormat(source, format) {
  if (format === 'mcp' || format === 'canonical') {
    return ownValue(source, 'inputSchema') === undefined
      ? ownValue(source, 'schema')
      : ownValue(source, 'inputSchema');
  }
  if (format === 'anthropic') return ownValue(source, 'input_schema');
  return ownValue(source, 'parameters');
}

function outputSchemaForFormat(source, format) {
  if (format === 'mcp' || format === 'canonical') return ownValue(source, 'outputSchema');
  return undefined;
}

function inferNamespace(name) {
  for (const separator of ['__', '.', '/']) {
    const index = name.indexOf(separator);
    if (index > 0) return name.slice(0, index);
  }
  return '';
}

export function normalizeTool(tool, options = {}) {
  if (!isObject(tool)) fail('ERR_TOOL_DEFINITION', 'Tool definition must be an object');
  if (!isObject(options)) fail('ERR_TOOL_ROUTER_OPTION', 'Normalization options must be an object');
  const format = explicitFormat(options.format) || detectToolFormat(tool);
  const source = sourceForFormat(tool, format);
  const name = stringValue(ownValue(source, 'name'));
  if (name.length === 0) fail('ERR_TOOL_NAME', 'Tool name must be a non-empty string');
  if (name.length > 512) fail('ERR_TOOL_NAME', 'Tool name must not exceed 512 characters');

  const description = stringValue(ownValue(source, 'description'));
  const explicitNamespace = stringValue(ownValue(tool, 'namespace')) || stringValue(ownValue(source, 'namespace'));
  const namespace = explicitNamespace || inferNamespace(name);
  const explicitId = stringValue(ownValue(tool, 'id')) || stringValue(ownValue(source, 'id'));
  const id = explicitId || (namespace ? `${namespace}:${name}` : name);
  const tags = stringList(ownValue(tool, 'tags')).concat(stringList(ownValue(source, 'tags')));
  const aliases = stringList(ownValue(tool, 'aliases')).concat(stringList(ownValue(source, 'aliases')));

  return Object.freeze({
    aliases: Object.freeze(Array.from(new Set(aliases))),
    description,
    format,
    id,
    inputSchema: schemaForFormat(source, format),
    name,
    namespace,
    original: tool,
    outputSchema: outputSchemaForFormat(source, format),
    tags: Object.freeze(Array.from(new Set(tags)))
  });
}

function unwrapTools(input) {
  if (Array.isArray(input)) return input;
  if (!isObject(input)) fail('ERR_TOOL_CATALOG', 'Tool catalog must be an array or provider envelope');
  const tools = ownValue(input, 'tools');
  if (Array.isArray(tools)) return tools;
  const declarations = ownValue(input, 'functionDeclarations');
  if (Array.isArray(declarations)) return declarations;
  fail('ERR_TOOL_CATALOG', 'Tool catalog envelope must contain tools or functionDeclarations');
}

export function normalizeTools(input, options = {}) {
  if (!isObject(options)) fail('ERR_TOOL_ROUTER_OPTION', 'Normalization options must be an object');
  const outer = unwrapTools(input);
  const maxTools = positiveInteger(options.maxTools, 100_000, 1_000_000, 'maxTools');
  if (outer.length > maxTools) {
    fail('ERR_TOOL_CATALOG_SIZE', `Tool catalog exceeds maxTools (${maxTools})`);
  }
  const flattened = [];
  for (let index = 0; index < outer.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(outer, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) continue;
    const value = descriptor.value;
    if (isObject(value) && Array.isArray(ownValue(value, 'functionDeclarations'))) {
      const declarations = ownValue(value, 'functionDeclarations');
      if (declarations.length > maxTools - flattened.length) {
        fail('ERR_TOOL_CATALOG_SIZE', `Tool catalog exceeds maxTools (${maxTools})`);
      }
      for (let inner = 0; inner < declarations.length; inner++) {
        const innerDescriptor = Object.getOwnPropertyDescriptor(declarations, String(inner));
        if (innerDescriptor && Object.prototype.hasOwnProperty.call(innerDescriptor, 'value')) {
          flattened.push(normalizeTool(innerDescriptor.value, { format: 'gemini' }));
        }
      }
    } else {
      flattened.push(normalizeTool(value, options));
    }
  }
  return flattened;
}
