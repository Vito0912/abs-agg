# Metadata Providers

Total Providers: 22

## Table of Contents

- [ARD Audiothek](#ardaudiothek)
- [Audible](#audible)
- [AudioSilo Meta](#audiosilo)
- [Audioteka](#audioteka)
- [Big Finish](#bigfinish)
- [BookBeat](#bookbeat)
- [Deezer](#deezer)
- [Die drei ???](#dreifragezeichen)
- [ElevenReader](#elevenreader)
- [Goodreads](#goodreads)
- [Graphic Audio](#graphicaudio)
- [Hardcover](#hardcover)
- [LibriVox](#librivox)
- [Libro.fm](#librofm)
- [Local catalog](#local)
- [Nextory](#nextory)
- [OverDrive](#overdrive)
- [Podium Entertainment](#podium)
- [Skoobe](#skoobe)
- [Soundbooth Theater](#soundbooththeater)
- [Storytel](#storytel)
- [The StoryGraph](#storygraph)

---

## ARD Audiothek

**ID:** `ardaudiothek`

**Description:** Fetches audiobook metadata from the ARD Audiothek (public broadcasters in Germany)

**Metadata provider:** [ARD Audiothek](https://www.ardaudiothek.de/)

**Inspiration:** [Source](https://github.com/h43lb1t0/ARD_Audiothek_provider)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-20 | 5 | Maximum number of results to return |
| `searchType` | enum | [search, programsets] | search | Search type: 'search' for general search (preferred for single items) or 'programsets' for program set specific search (preferred for podcasts) |

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

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

### Comments

- Metadata is in German.

---

## Audible

**ID:** `audible`

**Description:** Audiobook metadata from Audible's public catalog, with marketplace-specific identifiers and ratings

**Metadata provider:** [Audible](https://www.audible.com/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `region` | enum | [us, uk, de, fr, ca, au, it, es, in, jp, br] | us | Audible marketplace |
| `limit` | int | 1-20 | 5 | Maximum results |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `narrator`
- `description`
- `cover`
- `asin`
- `isbn`
- `publisher`
- `publishedYear`
- `language`
- `duration`
- `genres`
- `series`

### Example Request

```
GET /audible/search?title=example&author=author
```

---

## AudioSilo Meta

**ID:** `audiosilo`

**Description:** Community audiobook metadata with works, narrators, series, identifiers, and chapter timings

**Metadata provider:** [AudioSilo Meta](https://meta.audiosilo.app/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-10 | 5 | Maximum results |
| `region` | regex | `^[a-z]{2}$` | us | Preferred ASIN marketplace when a recording has several |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `narrator`
- `description`
- `cover`
- `asin`
- `isbn`
- `publisher`
- `publishedYear`
- `language`
- `duration`
- `genres`
- `series`

### Example Request

```
GET /audiosilo/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/audiosilo
```

Under "Auth" use `abs`

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## Audioteka

**ID:** `audioteka`

**Description:** Fetches audiobook metadata from Audioteka, a popular audiobook platform in Central and Eastern Europe

**Metadata provider:** [Audioteka](https://audioteka.com/)

**Inspiration:** [Source](https://github.com/lakafior/audioteka-abs)

### Parameters

#### Required Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `lang` | enum | [pl, cz, de, sk, lt] | - | Language/region code: pl (Polish), cz (Czech), de (German), sk (Slovak), lt (Lithuanian) |

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-20 | 5 | Maximum number of results to return |

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

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## Big Finish

**ID:** `bigfinish`

**Description:** Fetches audiobook metadata from Big Finish Productions (Doctor Who, Torchwood, and other audio dramas)

**Metadata provider:** [Big Finish](https://www.bigfinish.com/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-5 | 3 | Maximum number of results to return |

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

### Add to Audiobookshelf

```
https://provider.vito0912.de/bigfinish
```

Under "Auth" use `abs`

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## BookBeat

**ID:** `bookbeat`

**Description:** Fetches metadata from BookBeat's public search API

**Metadata provider:** [BookBeat](https://www.bookbeat.com/)

### Parameters

#### Required Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `market` | enum | [austria, belgium, bulgaria, croatia, cyprus, czechia, denmark, estonia, finland, france, germany, greece, hungary, ireland, italy, latvia, lithuania, luxembourg, malta, netherlands, norway, poland, portugal, romania, slovakia, slovenia, spain, sweden, switzerland, united-kingdom] | - | Market/country for the search (BookBeat region) |

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `includeErotic` | enum | [true, false] | false | Whether to include erotic books |
| `includeHighResCovers` | enum | [true, false] | false | Whether to include high resolution covers. This highly increases cover loading time |

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

### Example Request

```
GET /bookbeat/market:austria/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/bookbeat/market:austria
```

Under "Auth" use `abs`

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## Deezer

**ID:** `deezer`

**Description:** Fetches metadata from Deezer's music catalog

**Metadata provider:** [Deezer](https://www.deezer.com/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-10 | 5 | Maximum number of results to return |

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

- An optional DEEZER_ACCESS_TOKEN can be configured.

---

## Die drei ???

**ID:** `dreifragezeichen`

**Description:** Fetches metadata for the audiobook series 'Die drei ???'. Metadata is weekly from dreimetadaten.de

**Metadata provider:** [dreimetadaten](https://dreimetadaten.de/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-5 | 5 | Maximum number of results to return |

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

- Covers the main series, selected specials, and the kids series.

---

## ElevenReader

**ID:** `elevenreader`

**Description:** Fetches audiobook metadata from ElevenReader's public search and details APIs

**Metadata provider:** [ElevenReader](https://elevenreader.io/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-10 | 3 | Maximum books from the first search page to fetch details for |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `narrator`
- `publishedYear`
- `description`
- `cover`
- `bookId`
- `genres`
- `language`
- `duration`
- `poweredBy`

### Example Request

```
GET /elevenreader/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/elevenreader
```

Under "Auth" use `abs`

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## Goodreads

**ID:** `goodreads`

**Description:** Book metadata from Goodreads. Note: Covers may be low quality or missing. API is deprecated but still functional

**Metadata provider:** [Goodreads](https://www.goodreads.com)

**Inspiration:** [Source](https://github.com/ahobsonsayers/abs-tract)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-20 | 10 | Maximum number of results to return |

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

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

### Comments

- Requires an existing Goodreads API key; the public API is deprecated.

---

## Graphic Audio

**ID:** `graphicaudio`

**Description:** Fetches metadata from Graphic Audio's catalog. Graphic Audio produces dramatized audiobooks with full cast, music, and sound effects

**Metadata provider:** [Graphic Audio](https://www.graphicaudiointernational.net/)

**Inspiration:** [Source](https://github.com/binyaminyblatt/graphicaudio_scraper)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-20 | 10 | Maximum number of results to return |

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

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## Hardcover

**ID:** `hardcover`

**Description:** Book metadata from Hardcover.app

**Metadata provider:** [Hardcover](https://hardcover.app)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `language` | string | - | - | Filter by language code (e.g., 'en', 'de') |
| `limit` | int | 1-25 | 3 | Maximum number of results to return |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `description`
- `cover`
- `isbn`
- `asin`
- `publisher`
- `publishedYear`
- `language`
- `series`
- `tags`
- `duration`

### Example Request

```
GET /hardcover/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/hardcover
```

Under "Auth" use `abs`

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## LibriVox

**ID:** `librivox`

**Description:** Fetches metadata from LibriVox's public domain audiobook API. LibriVox provides free public domain audiobooks read by volunteers

**Metadata provider:** [LibriVox](https://librivox.org/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `genre` | string | - | - | Filter results by genre (e.g., 'Fiction', 'Science Fiction', 'Poetry') |
| `limit` | int | 1-20 | 10 | Maximum number of results to return |

### Returned Fields

- `title`
- `author`
- `narrator`
- `description`
- `cover`
- `genres`
- `language`
- `duration`
- `publishedYear`
- `bookId`

### Example Request

```
GET /librivox/search?title=example&author=author
```

### Comments

- Prefix title, author, or genre with ^ to match the beginning of the term.

---

## Libro.fm

**ID:** `librofm`

**Description:** Fetches metadata from Libro.fm, a DRM-free audiobook retailer

**Metadata provider:** [Libro.fm](https://libro.fm)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-6 | 3 | Maximum results to return |
| `searchby` | enum | [all, titles, authors] | all | Field to search by (titles or authors) |
| `lang` | enum | [all, cmn, bas, gem, ger, gsw, hai, yue, cpf, afr, alb, amh, ara, arm, asm, aze, baq, bel, ben, bos, bul, cat, chi, cze, dan, dut, eng, est, fin, fre, geo, gle, glg, gre, guj, hat, heb, hin, hrv, hun, ice, ind, ita, jav, jpn, kan, kaz, kir, kor, kur, lat, lav, lit, ltz, lug, mac, mal, mao, mar, may, mlg, mlt, nep, nno, nob, nor, oci, ori, pan, per, pol, por, rum, rus, san, sin, slo, slv, som, spa, srp, swa, swe, tam, tel, tgk, tgl, tha, tur, twi, ukr, urd, uzb, vie, yor, zha, zul] | all | Language of the audiobook searched for |
| `ai_narrated` | enum | [true, false] | false | Whether to include AI-narrated audiobooks |

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

---

## Local catalog

**ID:** `local`

**Description:** Searches metadata already collected from enabled providers without upstream requests

**Metadata provider:** Local metadata catalog

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-50 | 10 | Maximum results |

### Returned Fields

- `title`
- `author`
- `narrator`
- `description`
- `cover`
- `isbn`
- `asin`
- `series`
- `duration`
- `language`

### Example Request

```
GET /local/search?title=example&author=author
```

---

## Nextory

**ID:** `nextory`

**Description:** Fetches audiobook and ebook metadata from Nextory's public search API

**Metadata provider:** [Nextory](https://nextory.com/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `type` | enum | [all, audiobook, ebook] | all | Content format. Use audiobook to exclude ebooks |
| `includeErotic` | enum | [true, false] | true | Include books flagged is_adult_book by Nextory. Set false to exclude them |
| `limit` | int | 1-12 | 12 | Maximum number of results |
| `market` | enum | [DE, AT, CH, DK, ES, FI, FR, NL, NO, SE] | DE | Nextory country code |

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
GET /nextory/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/nextory
```

Under "Auth" use `abs`

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## OverDrive

**ID:** `overdrive`

**Description:** Fetches audiobook and ebook metadata from an OverDrive library

**Metadata provider:** [OverDrive](https://www.overdrive.com/)

### Parameters

#### Required Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `library` | regex | `^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?(?![\s\S])` | - | Library slug |

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `type` | enum | [all, ebook, audiobook] | all | Content format |
| `limit` | int | 1-24 | 3 | Maximum number of results |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `narrator`
- `description`
- `cover`
- `isbn`
- `publisher`
- `publishedYear`
- `language`
- `duration`
- `series`
- `genres`

### Example Request

```
GET /overdrive/library:example/search?title=example&author=author
```

---

## Podium Entertainment

**ID:** `podium`

**Description:** Fetches book metadata from Podium Entertainment

**Metadata provider:** [Podium Entertainment](https://podiumentertainment.com/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-20 | 5 | Maximum number of results |

### Returned Fields

- `title`
- `author`
- `narrator`
- `description`
- `cover`
- `isbn`
- `publisher`
- `publishedYear`
- `language`
- `duration`
- `series`
- `genres`

### Example Request

```
GET /podium/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/podium
```

Under "Auth" use `abs`

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## Skoobe

**ID:** `skoobe`

**Description:** Fetches ebook and audiobook metadata from Skoobe's public website

**Metadata provider:** [Skoobe](https://www.skoobe.de/)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-6 | 3 | Maximum number of results |
| `type` | enum | [all, ebook, audiobook] | all | Content format |

### Returned Fields

- `title`
- `subtitle`
- `author`
- `narrator`
- `description`
- `cover`
- `language`
- `publishedYear`
- `publisher`
- `duration`

### Example Request

```
GET /skoobe/search?title=example&author=author
```

---

## Soundbooth Theater

**ID:** `soundbooththeater`

**Description:** Audiobook metadata from Soundbooth Theater's public catalog

**Metadata provider:** [Soundbooth Theater](https://soundbooththeater.com)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-20 | 10 | Maximum number of results |

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
- `isbn`
- `language`
- `tags`

### Example Request

```
GET /soundbooththeater/search?title=example&author=author
```

### Add to Audiobookshelf

```
https://provider.vito0912.de/soundbooththeater
```

Under "Auth" use `abs`

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## Storytel

**ID:** `storytel`

**Description:** Fetches metadata from Storytel's public search API

**Metadata provider:** [Storytel](https://www.storytel.com/)

### Parameters

#### Required Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `language` | enum | [en, sv, no, dk, fi, is, de, es, fr, it, pl, nl, pt, bg, tr, ru, ar, hi, id, th] | - | Language/locale for the search (ISO language code) |

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-10 | 3 | Maximum number of results to return |
| `type` | enum | [audiobook, ebook, all] | all | Type of content to search for |

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

For deployments with authentication enabled, use the configured `AUTH_TOKEN` instead.

> The URL can be replaced by your own deployment. The hosted provider can break at any moment.

---

## The StoryGraph

**ID:** `storygraph`

**Description:** Fetches book metadata from The StoryGraph

**Metadata provider:** [The StoryGraph](https://app.thestorygraph.com)

### Parameters

#### Optional Parameters

| Name | Type | Validation | Default | Description |
|------|------|------------|---------|-------------|
| `limit` | int | 1-5 | 3 | Maximum number of results to return |

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

---

