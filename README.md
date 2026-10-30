# abs-agg

A metadata provider server for [Audiobookshelf](https://github.com/advplyr/audiobookshelf). Aggregates audiobook metadata from multiple sources through a unified API.

abs-agg named after "aggregate" and the German "AGG", because each provider should be usable as the others.

> This project actively uses LLMs for development and testing purposes

## Supported metadata providers

- ARD Audiothek
- Audible
- AudioSilo Meta
- Audioteka
- Big Finish
- BookBeat
- Deezer
- Die drei ???
- ElevenReader
- Goodreads
- Graphic Audio
- Hardcover
- Libro.fm
- LibriVox
- Nextory
- OverDrive
- Podium Entertainment
- Skoobe
- Soundbooth Theater
- Storytel
- The StoryGraph

- Local catalog

For detailed documentation on each provider, see [Providers.md](Providers.md).

This unifies many existing audiobook metadata providers into a single server:
<details><summary>Other provider attribution</summary>

- https://github.com/ahobsonsayers/abs-tract
- https://github.com/lakafior/audioteka-abs
- https://github.com/vito0912/abs-bigfinish
- https://github.com/Revisor01/abs-storytel-provider
- https://github.com/Vito0912/hardcover-provider
- https://github.com/h43lb1t0/ARD_Audiothek_provider
- https://github.com/binyaminyblatt/graphicaudio_scraper

</details>

## Quick Start

### Hosted service

You can use the hosted service at [provider.vito0912.de](https://provider.vito0912.de/).
In Audiobookshelf, use `https://provider.vito0912.de/<provider>` with any required path parameters and set **Auth** to `abs`.

The hosted service may be unavailable at any time. See the [privacy policy](PRIVACYPOLICY.md) before using it.

### Using Docker (recommended)

```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/vito0912/abs-agg:latest
```

Or with docker-compose:

See [docker-compose.yml](docker-compose.yml).

## API Usage

### List available providers

```
GET /providers
```

### Search for audiobooks

```
GET /:provider/search?title=<title>&author=<author>
```

**Required parameters:**

- `title` - Book title to search for

**Optional parameters:**

- `author` - Author name
- `cache` - Set to `false` to bypass cache

**Example:**

```bash
curl "http://localhost:3000/librivox/search?title=sherlock+holmes&author=doyle"
```

> [!IMPORTANT]
> Parameters (especially optional ones, as they are not in the examples of the providers) must be in the following format:
> `<host>/provider/<parameter1>/../<parameter2>/search?title=<title>&author=<author>`\
> \
> Example:
> `http://localhost:3000/librivox/limit:10/search?title=sherlock+holmes&author=doyle`
>
> For **ABS**! do not add `/search` at the end. Just use:\
> `http://localhost:3000/librivox/limit:10

## Configuration

Environment variables:

| Variable                           | Required                  | Description                                                                  |
| ---------------------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| `PORT`                             | No                        | Server port (default: 3000)                                                  |
| `AUTH_TOKEN`                       | No                        | Enables and uses value as authentication                                     |
| `PROVIDER_WHITELIST`               | No                        | Comma-separated provider IDs to load (default: all available providers)      |
| `HARDCOVER_TOKEN`                  | No                        | API token for Hardcover provider                                             |
| `GOODREADS_KEY`                    | No                        | API key for Goodreads provider                                               |
| `DEEZER_ACCESS_TOKEN`              | No                        | Token for higher rate limits                                                 |
| `ENABLE_LOCAL_PROVIDER`            | No                        | Enable the local catalog provider (default: false)                           |
| `ENABLE_CROSS_PROVIDER_ENRICHMENT` | No                        | Fill missing descriptions from compatible stored metadata (default: false)   |
| `METADATA_DATABASE_PATH`           | No                        | SQLite database path (default: ./data/metadata.sqlite)                       |
| `CACHE_SEARCH_TTL_SECONDS`         | No                        | Search freshness in seconds before jitter (default: 3600)                    |
| `CACHE_DETAIL_TTL_SECONDS`         | No                        | Detail freshness in seconds before jitter (default: 86400)                   |
| `CACHE_NEGATIVE_TTL_SECONDS`       | No                        | Empty or incomplete result freshness in seconds (default: 120)               |
| `OTEL_ENABLED`                     | No                        | Enable OpenTelemetry export (default: false)                                 |
| `OTEL_LOGS_ENABLED`                | No                        | Export logs when OTEL is enabled (default: true)                             |
| `OTEL_METRICS_ENABLED`             | No                        | Export metrics when OTEL is enabled (default: true)                          |
| `OTEL_TRACES_ENABLED`              | No                        | Export traces when OTEL is enabled (default: false)                          |
| `OTEL_SERVICE_NAME`                | No                        | Telemetry service name (default: abs-agg)                                    |
| `OTEL_EXPORTER_OTLP_ENDPOINT`      | When telemetry is enabled | External collector base URL, e.g. http://alloy:4318                          |
| `OTEL_METRIC_EXPORT_INTERVAL`      | No                        | Metric export interval in milliseconds (default: 60000)                      |
| `LOG_REQUESTS`                     | No                        | Enable JSON request logs with trace/span IDs when available (default: false) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
