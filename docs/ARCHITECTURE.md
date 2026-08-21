# Architecture

## Data flow

1. An adapter detects the provider shape and creates an immutable normalized
   record while retaining the original definition by reference.
2. Schema text is extracted with bounded, getter-free traversal.
3. Names, namespaces, aliases, tags, descriptions, and schema text are
   tokenized into weighted field postings.
4. A query is normalized, uppercase acronyms are identified, and action
   synonyms are expanded with lower weight than literal terms.
5. BM25F-style scores are calculated from current document frequencies and
   field lengths.
6. Literal name and namespace matches receive explicit intent bonuses.
7. Results are ordered deterministically and constrained by count and estimated
   token budgets.

## Modules

| Module | Responsibility |
| --- | --- |
| `adapters.js` | provider detection and immutable normalized records |
| `tokenize.js` | Unicode normalization, identifier splitting, trigrams, edit distance |
| `schema.js` | bounded schema text collection and JSON token estimation |
| `router.js` | postings, incremental catalog updates, ranking, filters, budgets |
| `search-tool.js` | provider-shaped catalog discovery function |
| `safe.js` | own-data-property reads and option validation |
| `errors.js` | stable typed error codes |

## Index structure

The router keeps:

- a `Map` from tool ID to normalized document;
- a term posting `Map` from term to document field frequencies;
- bounded prefix and trigram maps for completion and typo candidates;
- current field-length totals for ranking normalization;
- cached per-tool token estimates for route budgets.

Incremental removal deletes postings, lexicon entries, field totals, and token
estimates. Replacement is transactional: all incoming tools are normalized and
prepared before the live index changes.

## Ranking semantics

Each original query term is a disjunction. Literal, prefix, synonym, and fuzzy
expansions compete, and only the strongest contribution for that query term is
added to a document. This prevents a document from receiving several votes
because it happens to contain multiple words from one synonym group.

Field weights are inputs to a BM25F-style normalized term frequency. Exact
whole identifiers receive a larger bonus; literal name and namespace tokens
receive smaller bonuses. Query coverage moderates partial matches.

Fuzzy candidates are drawn from a trigram index before bounded edit distance is
calculated. The implementation never compares every query token against every
catalog term.

## Provider boundary

Adapters identify where each provider stores name, description, and input
schema. They do not translate schemas. Returning the original object avoids
subtle wire incompatibilities and lets applications continue using their
current SDK and type definitions.

## Security design

Untrusted keys never become properties on ordinary internal objects. Schema
traversal uses own property descriptors and skips accessors. Dangerous
prototype keys are ignored. Weak sets detect cycles, and all potentially large
dimensions have defaults and absolute option bounds.

Search regular expressions are fixed library constants with linear behavior.
Fuzzy matching uses bounded dynamic programming over tokens limited to 256
characters.

## Complexity

- Build: proportional to indexed tokens and schema nodes.
- Literal query: proportional to postings for matching terms.
- Fuzzy fallback: proportional to trigram candidates, not the complete term
  dictionary.
- Add/remove: proportional to tokens in the affected tools.

Very large catalogs should benchmark memory and latency with their real schema
distribution. A future precompiled-index format is tracked in TODO.md.
