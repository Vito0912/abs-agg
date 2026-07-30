# abs-agg

A metadata provider server for [Audiobookshelf](https://github.com/advplyr/audiobookshelf). Aggregates audiobook metadata from multiple sources through a unified API.

This currently does not mean it connects them between providers. This might be added in the future.

abs-agg named after "aggregate" and the German "AGG", because each provider should be usable as the others.

## Supported metadata providers

- ARD Audiothek
- Audioteka
- Big Finish
- BookBeat
- Goodreads
- Graphic Audio
- Hardcover
- LibriVox
- Libro
- Storytel
- The StoryGraph
- Die drei ???
- Soundbooth

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

| Variable              | Required | Description                      |
| --------------------- | -------- | -------------------------------- |
| `PORT`                | No       | Server port (default: 3000)      |
| `HARDCOVER_TOKEN`     | No       | API token for Hardcover provider |
| `GOODREADS_KEY`       | No       | API key for Goodreads provider   |
| `DEEZER_ACCESS_TOKEN` | No       | Token for higher rate limits     |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
