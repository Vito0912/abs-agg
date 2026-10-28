This document has been AI-generated from the source code and is intended to give contributors a high-level overview of the provider architecture.

# Adding a provider

Create a directory under `src/providers/` with `config.json` and an `index.ts` exporting a `BaseProvider` subclass. The registry validates the configuration and passes it to the constructor. Providers must not read their own configuration files or implement their own book/search caches.

All current metadata requests end in `/search`. ABS calls the provider's configured base URL with `/search` appended and sends `query` and optionally `author`. The server also accepts `title` for compatibility. There are no public lookup or versioned endpoints.

## Configuration

```json
{
  "id": "myprovider",
  "name": "My Provider",
  "provider": {
    "name": "Metadata source",
    "url": "https://example.com"
  },
  "available": true,
  "addToAudiobookshelf": true,
  "description": "Audiobook metadata from Example",
  "url": "https://example.com",
  "parameters": [
    {
      "name": "limit",
      "required": false,
      "default": 5,
      "validation": { "type": "int", "min": 1, "max": 10 },
      "description": "Maximum results"
    }
  ],
  "returnedFields": ["title", "author", "description", "cover", "duration"],
  "comments": [],
  "credits": [{ "url": "https://github.com/example/original-provider" }]
}
```

`provider` identifies the metadata source. `url` remains the provider's website for compatibility. `credits` links to projects that inspired the provider and appears as Inspiration in generated documentation. `comments` should contain only important restrictions, prerequisites, or coverage limitations. Do not describe routine implementation details there. `returnedFields` describes the ABS response, not every internally retained field.

Use `requiredEnv` for mandatory credentials. Keep providers disabled when their upstream service is unavailable or their implementation is incomplete.

Put parameter defaults in the `default` field, using numbers for numeric parameters and strings for other parameters (including `"true"`/`"false"` enums). Defaults are validated when configuration loads and applied when a request omits the parameter. Keep defaults out of descriptions; generated documentation has a separate Default column.

Never end a `description` value in `config.json` with a period. This applies to provider descriptions and parameter descriptions.

## Fetch, validate, and map

Keep upstream schemas in `schemas.ts`, inferred DTO types in `types.ts`, and fetching/mapping in separate files when that makes the implementation easier to read. Shared domain schemas live in `src/types/metadata.ts`; configuration types are inferred from `src/types/config.ts`.

```typescript
import { z } from 'zod'
import { BaseProvider } from '../BaseProvider'
import type { BookMetadata, ParsedParameters } from '../../types'
import { httpClient } from '../../utils/httpClient'
import { normalizeBookMetadata } from '../../utils/helpers'

const responseSchema = z.object({
  books: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      author: z.string().optional(),
      description: z.string().optional(),
      duration_seconds: z.number().nonnegative().optional()
    })
  )
})

export default class ExampleProvider extends BaseProvider {
  protected async searchBooks(
    title: string,
    _author: string | null,
    params: ParsedParameters
  ): Promise<BookMetadata[]> {
    const response = await httpClient.get('https://example.com/audiobooks', {
      params: { query: title }
    })

    if (response.status === 404) return []

    const data = responseSchema.parse(response.data)
    const limit = Number(params.limit) || 5

    return data.books.slice(0, limit).map((book) =>
      normalizeBookMetadata({
        title: book.title,
        bookId: book.id,
        author: book.author,
        description: book.description,
        durationSeconds: book.duration_seconds,
        format: 'audiobook'
      })
    )
  }
}
```

`BookMetadata` is the extraction DTO for book adapters. It is converted into validated normalized entities before persistence; it is not the database schema or the public ABS schema. `normalizeBookMetadata` preserves supported richer fields and validates the extraction result. It does not validate an upstream response: parse that response with its own schema first.

Use stable source IDs when available. For multiple editions, keep every edition's identifiers, language, cover, publisher, and duration together. Never combine one edition's ISBN with another edition's ASIN. Use `work` for explicitly supplied work relationships and work-level ratings. Preserve individual contributors and their IDs rather than joining their names before normalization.

`format` may be `audiobook` or `ebook`; omit it when the source does not establish either. A dedicated audiobook endpoint establishes audiobook format. Generic book search does not. Internal durations use seconds; only the ABS response adapter converts to minutes.

Validated metadata is retained permanently, independently of response caching, including requests with `cache=false` and legacy cache-bypass environment flags. Use the internal `ingestMetadata` command to save a normalized bundle without creating response-cache entries. It accepts every entity kind, including standalone authors, series, and chapters. There are no cache count, cache size, pending-job, or automatic entity-retention limits. Ordinary cache clearing preserves entity rows; only explicit catalog deletion removes them.

## Detail and collection fetching

For providers with a dedicated book-detail endpoint, implement `fetchBook(id, params)`. Search can call the inherited `getBookById(id, params)` to reuse the shared normalized detail cache. This is an internal operation; it does not create an HTTP lookup endpoint.

When detail fetching requires a search result or URL, use `cachedBook(id, params, loader)`. Return a full extraction DTO from the loader. Do not store partial objects or raw responses in the book cache.

Use `cachedMetadata(kind, id, params, loader)` when a detail response produces a normalized bundle, such as a work containing several books. This shares the book-detail cache infrastructure and supports all normalized entity kinds.

Use `storedCatalog` for larger source collections. Supply `this.cacheIdentity`, a collection name, a freshness interval in milliseconds, and a loader returning a normalized `MetadataBundle`. Validate the upstream payload and normalize the entire downloaded collection in the loader. Every entity is upserted into the same durable entity store used by search/detail responses and the local provider. Catalog rows contain only a small manifest; collection membership references existing entity rows. Do not store raw collection payloads or create provider-specific disk caches.

Catalog ingestion is demand-driven and coalesces concurrent requests. Response-cache bypass still uses and populates the durable catalog. Explicit refresh can update a collection early unless `minimumRefreshIntervalMs` is specified; that download limit persists across restarts and also covers failed attempts. Soundbooth Theater uses a 24-hour minimum interval. Refreshes merge new and updated records into the collection while retaining previously collected records that are no longer returned upstream.

Freshness intervals control when responses are refreshed, not when data is deleted. Positive cached results remain usable indefinitely. A failed refresh, or an empty result for a previously successful lookup/search, preserves the previous metadata. Empty and incomplete answers use the short negative freshness interval for retrying. Automatic maintenance removes only expired refresh guards and unreferenced snapshot versions; cached entries and accumulated entities are not evicted.

Entity IDs identify provider-specific source records. Refreshes update those rows, and identical response snapshots share a content revision even when their fetch times differ. Observation timestamps belong to cache references so sharing snapshots preserves each response's original fetch time. Different providers remain attributable source records; fuzzy similarity must not merge identities.

All search, detail, and catalog keys use `buildCacheKey` with a typed request. The key includes the provider ID, adapter version, cache type, and a hash of the relevant request fields. Detail keys also distinguish entity kinds. Parameter order is normalized; search-only limits do not fragment detail entries. Override `adapterVersion` when a provider's cached interpretation changes. These are internal cache versions and do not affect HTTP URLs. Providers must not assemble their own cache key strings.

Use `mapConcurrent` for independent detail fetches, normally with concurrency 3. The shared HTTP client also limits concurrent requests per host and applies request/queue deadlines. Do not catch an upstream failure and return an ordinary empty search. If a detail failure can recover with a search summary, return that summary with `quality: 'summary'` so the search receives a short TTL.

## Internal metadata extension points

The normalized entity union contains `book`, `work`, `author`, `series`, and `chapter`. Author, series, and chapter entities can exist independently. Relationships are optional, and chapter timing and sequence are optional. An upstream chapter ID remains the chapter's own source ID.

A provider supplying native normalized entities can override `searchEntities` and `capabilities` instead of implementing `searchBooks`. `lookupMetadata` and the local catalog repository are internal extension points for future author, series, or chapter endpoints. Do not add those HTTP endpoints until requested.

Normalized records retain source identity, fetch time, identifiers, contributor roles, work/series relationships, ratings with their original scale/counts, dates with their available precision, chapter metadata, and field provenance. These fields can be retained even when ABS cannot consume them yet.
