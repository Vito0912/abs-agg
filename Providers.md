# Metadata Providers

Total Providers: 14

## Table of Contents

- [ARD Audiothek](#ardaudiothek)
- [Audioteka](#audioteka)
- [Big Finish](#bigfinish)
- [BookBeat](#bookbeat)
- [Deezer](#deezer)
- [Die drei ???](#dreifragezeichen)
- [Goodreads](#goodreads)
- [Graphic Audio](#graphicaudio)
- [Hardcover](#hardcover)
- [LibriVox](#librivox)
- [Libro.fm](#librofm)
- [Soundbooth Theater](#soundbooththeater)
- [Storytel](#storytel)
- [The StoryGraph](#storygraph)

---

## ARD Audiothek

**ID:** `ardaudiothek`

**Description:** Fetches audiobook metadata from the ARD Audiothek (public broadcasters in Germany).

**Metadata-URL:** [https://www.ardaudiothek.de/](https://www.ardaudiothek.de/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-20 | Maximum number of results to return (default: 5, max: 20) |
| `searchType` | enum | [search, programsets] | Search type: 'search' (default) for general search (preferred for single items) or 'programsets' for program set specific search (preferred for podcasts) |

### Returned Fields

- `title`
- `author`
- `description`
- `cover`
- `publisher`
- `genres`
- `tags`
- `series`
- `language`

### Example Request

```
GET /ardaudiothek/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/ardaudiothek
```

Under "Auth" use `abs`

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

### Comments

- German language only provider.
- Credits https://github.com/h43lb1t0/ARD_Audiothek_provider for inital idea in Python

---

## Audioteka

**ID:** `audioteka`

**Description:** Fetches audiobook metadata from Audioteka, a popular audiobook platform in Central and Eastern Europe.

**Metadata-URL:** [https://audioteka.com/](https://audioteka.com/)

### Parameters

#### Required Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `lang` | enum | [pl, cz, de, sk, lt] | Language/region code: pl (Polish), cz (Czech), de (German), sk (Slovak), lt (Lithuanian) |

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-20 | Maximum number of results to return (default: 5, max: 20) |

### Returned Fields

- `title`
- `author`
- `narrator`
- `description`
- `cover`
- `publisher`
- `genres`
- `tags`
- `series`
- `language`
- `duration`

### Example Request

```
GET /audioteka/lang:pl/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/audioteka/lang:pl
```

Under "Auth" use `abs`

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

### Comments

- Credits https://github.com/lakafior/audioteka-abs for the original implementation.

---

## Big Finish

**ID:** `bigfinish`

**Description:** Fetches audiobook metadata from Big Finish Productions (Doctor Who, Torchwood, and other audio dramas).

**Metadata-URL:** [https://www.bigfinish.com/](https://www.bigfinish.com/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-5 | Maximum number of results to return (default: 3, max: 5) |

### Returned Fields

- `title`
- `author`
- `narrator`
- `description`
- `cover`
- `isbn`
- `series`
- `language`
- `publishedYear`
- `publisher`
- `duration`

### Example Request

```
GET /bigfinish/search?title=example&author=author
```

---

## BookBeat

**ID:** `bookbeat`

**Description:** Fetches metadata from BookBeat's public search API.

**Metadata-URL:** [https://www.bookbeat.com/](https://www.bookbeat.com/)

### Parameters

#### Required Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `market` | enum | [austria, belgium, bulgaria, croatia, cyprus, czechia, denmark, estonia, finland, france, germany, greece, hungary, ireland, italy, latvia, lithuania, luxembourg, malta, netherlands, norway, poland, portugal, romania, slovakia, slovenia, spain, sweden, switzerland, united-kingdom] | Market/country for the search (BookBeat region) |

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `includeErotic` | enum | [true, false] | Whether to include erotic books (default: false) |
| `includeHighResCovers` | enum | [true, false] | Whether to include high resolution covers. This highly increases cover loading time (default: false) |

### Returned Fields

- `title`
- `author`
- `description`
- `cover`
- `isbn`
- `series`
- `language`
- `publishedYear`

### Example Request

```
GET /bookbeat/market:austria/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/bookbeat/market:austria
```

Under "Auth" use `abs`

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

### Comments

- Data might be unrelated a bit.
- There are made up to 4 requests per search, so consider ratelimiting if self-hosted! Please check you local laws regarding web scraping and API usage.

---

## Deezer

**ID:** `deezer`

**Description:** Fetches metadata from Deezer's music catalog.

**Metadata-URL:** [https://www.deezer.com/](https://www.deezer.com/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-10 | Maximum number of results to return (default: 5, max: 10) |

### Returned Fields

- `title`
- `author`
- `cover`
- `publisher`
- `publishedYear`
- `genres`
- `duration`

### Example Request

```
GET /deezer/search?title=example&author=author
```

### Comments

- Use the `DEEZER_ACCESS_TOKEN` environment variable to provide a user OAuth token for higher rate limits.

---

## Die drei ???

**ID:** `dreifragezeichen`

**Description:** Fetches metadata for the audiobook series 'Die drei ???'. Metadata is weekly from dreimetadaten.de.

**Metadata-URL:** [https://dreifragezeichen.de/](https://dreifragezeichen.de/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-5 | Maximum number of results to return (default: 5, max: 5) |

### Returned Fields

- `title`
- `author`
- `narrator`
- `description`
- `cover`
- `publishedYear`
- `series`
- `duration`
- `language`
- `tags`

### Example Request

```
GET /dreifragezeichen/search?title=example&author=author
```

### Comments

- Data provided by https://dreimetadaten.de
- Does include the main series, some specials and kids series

---

## Goodreads

**ID:** `goodreads`

**Description:** Book metadata from Goodreads. Note: Covers may be low quality or missing. API is deprecated but still functional.

**Metadata-URL:** [https://www.goodreads.com](https://www.goodreads.com)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-20 | Maximum number of results to return (default: 10, max: 20) |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `description`
- `cover`
- `isbn`
- `publisher`
- `publishedYear`
- `language`
- `series`
- `genres`

### Example Request

```
GET /goodreads/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/goodreads
```

Under "Auth" use `abs`

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

### Comments

- Covers may be low quality or missing due to API limitations
- Credits to https://github.com/ahobsonsayers/abs-tract

---

## Graphic Audio

**ID:** `graphicaudio`

**Description:** Fetches metadata from Graphic Audio's catalog. Graphic Audio produces dramatized audiobooks with full cast, music, and sound effects.

**Metadata-URL:** [https://www.graphicaudiointernational.net/](https://www.graphicaudiointernational.net/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-20 | Maximum number of results to return (default: 10, max: 20) |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `narrator`
- `description`
- `cover`
- `isbn`
- `asin`
- `genres`
- `series`
- `publishedYear`

### Example Request

```
GET /graphicaudio/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/graphicaudio
```

Under "Auth" use `abs`

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

### Comments

- Credits to https://github.com/binyaminyblatt/graphicaudio_scraper

---

## Hardcover

**ID:** `hardcover`

**Description:** Book metadata from Hardcover.app

**Metadata-URL:** [https://hardcover.app](https://hardcover.app)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `language` | string | - | Filter by language code (e.g., 'en', 'de') |
| `limit` | int | 1-25 | Maximum number of results to return (default: 10, max: 25) |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `narrator`
- `description`
- `cover`
- `isbn`
- `asin`
- `publisher`
- `publishedYear`
- `language`
- `series`
- `tags`

### Example Request

```
GET /hardcover/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/hardcover
```

Under "Auth" use `abs`

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

### Comments

- The searching seems to be a bit broken, not finding results that exist.

---

## LibriVox

**ID:** `librivox`

**Description:** Fetches metadata from LibriVox's public domain audiobook API. LibriVox provides free public domain audiobooks read by volunteers.

**Metadata-URL:** [https://librivox.org/](https://librivox.org/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `genre` | string | - | Filter results by genre (e.g., 'Fiction', 'Science Fiction', 'Poetry') |
| `limit` | int | 1-20 | Maximum number of results to return (default: 10, max: 20) |

### Returned Fields

- `title`
- `author`
- `description`
- `cover`
- `genres`
- `language`
- `duration`
- `publishedYear`

### Example Request

```
GET /librivox/search?title=example&author=author
```

### Comments

- Use ^ prefix in title/author to anchor search to beginning of term

---

## Libro.fm

**ID:** `librofm`

**Description:** Fetches metadata from Libro.fm, a DRM-free audiobook retailer.

**Metadata-URL:** [https://libro.fm](https://libro.fm)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-6 | Maximum results to return |
| `searchby` | enum | [all, titles, authors] | Field to search by (titles or authors). If not specified, defaults to searching by all. |
| `lang` | enum | [all, cmn, bas, gem, ger, gsw, hai, yue, cpf, afr, alb, amh, ara, arm, asm, aze, baq, bel, ben, bos, bul, cat, chi, cze, dan, dut, eng, est, fin, fre, geo, gle, glg, gre, guj, hat, heb, hin, hrv, hun, ice, ind, ita, jav, jpn, kan, kaz, kir, kor, kur, lat, lav, lit, ltz, lug, mac, mal, mao, mar, may, mlg, mlt, nep, nno, nob, nor, oci, ori, pan, per, pol, por, rum, rus, san, sin, slo, slv, som, spa, srp, swa, swe, tam, tel, tgk, tgl, tha, tur, twi, ukr, urd, uzb, vie, yor, zha, zul] | Language of the audiobook searched for. If not specified, defaults to all (search in all languages). |
| `ai_narrated` | enum | [true, false] | Whether to include AI-narrated audiobooks. Default is false. |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `narrator`
- `publisher`
- `publishedYear`
- `description`
- `cover`
- `isbn`
- `bookId`
- `genres`
- `series`
- `language`
- `duration`

### Example Request

```
GET /librofm/search?title=example&author=author
```

### Comments

- Uses the unauthenticated and public Libro.fm API

---

## Soundbooth Theater

**ID:** `soundbooththeater`

**Description:** Soundbooth Theater

**Metadata-URL:** [https://soundbooththeater.com](https://soundbooththeater.com)

### Parameters

No parameters required.

### Returned Fields

- `title`
- `series`
- `cover`
- `author`
- `narrator`
- `description`
- `duration`
- `publishedYear`
- `genres`
- `subtitle`

### Example Request

```
GET /soundbooththeater/search?title=example&author=author
```

### Comments

- The implementation of this provider is highly experimental and may not work reliably.

---

## Storytel

**ID:** `storytel`

**Description:** Fetches metadata from Storytel's public search API.

**Metadata-URL:** [https://www.storytel.com/](https://www.storytel.com/)

### Parameters

#### Required Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `language` | enum | [en, sv, no, dk, fi, is, de, es, fr, it, pl, nl, pt, bg, tr, ru, ar, hi, id, th] | Language/locale for the search (ISO language code) |

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-10 | Maximum number of results to return (default: 3, max: 10) |
| `type` | enum | [audiobook, ebook, all] | Type of content to search for (default: all) |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `narrator`
- `description`
- `cover`
- `isbn`
- `series`
- `language`
- `publishedYear`
- `publisher`
- `duration`
- `tags`

### Example Request

```
GET /storytel/language:en/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/storytel/language:en
```

Under "Auth" use `abs`

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

### Comments

- Titles and series information are automatically cleaned using language-specific patterns.

---

## The StoryGraph

**ID:** `storygraph`

**Description:** Fetches book metadata from The StoryGraph.

**Metadata-URL:** [https://app.thestorygraph.com](https://app.thestorygraph.com)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Description |
|------|------|------------|-------------|
| `limit` | int | 1-5 | Maximum number of results to return (default: 3, max: 5) |

### Returned Fields

- `title`
- `author`
- `publisher`
- `publishedYear`
- `description`
- `cover`
- `isbn`
- `language`
- `poweredBy`

### Example Request

```
GET /storygraph/search?title=example&author=author
```

### Comments

- Uses The StoryGraph's unauthenticated public turbo api

---
