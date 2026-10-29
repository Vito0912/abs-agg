# Privacy Policy

Last updated: 29 October 2026

## 1. Scope and contact

This policy explains how we process data when you use the hosted abs-agg metadata search service. It covers search requests, stored metadata, infrastructure, and sharing metadata for an open-source database.

For privacy questions or requests concerning your data, please use the contact details in our [Imprint](https://vito0912.de/impressum/).

## 2. Search requests and stored data

We process the search terms and parameters supplied by your client to answer searches. In the metadata database, we store a SHA-256 hash derived from these inputs as a cache key, together with returned metadata. This lets us recognize repeated requests and reduce unnecessary requests to external providers. Returned metadata, such as book titles and author names, is stored in readable form.

Cache keys and results are stored without your IP address or other client identifiers. We do not maintain a mapping between these database records and individual users or use them to build personal reading profiles.

The hash cannot be directly decoded back into the query. Clear-text search terms may appear in infrastructure logs, which we retain for no more than 7 days, as described in section 5.

## 3. Requests to external metadata providers

When an external lookup is needed, we send the search terms or identifiers required to answer it to the selected metadata provider. This may include the exact title or author you entered.

These requests originate from our server. We do not forward your client IP address or client authentication credentials. The external provider receives our server's IP address and processes the request under its own privacy policy.

Available metadata sources and their links are listed in the [provider documentation](Providers.md).

## 4. Sharing metadata for an open-source database

### What may be shared

Metadata returned by searches may be retained, shared with other metadata providers, and made publicly available to build and improve an open-source metadata database.

This includes, but is not limited to, books, works, authors and other contributors, series, chapters, descriptions, identifiers, publication information, languages, durations, ratings, covers or cover references, and relationships between records.

Records may include the original provider's name, source identifier, and a link to the original record. Sharing remains subject to applicable rights and source licensing conditions.

### What is excluded

We do not include your search query, query-derived cache keys, IP address, authentication information, client identifiers, or request-level identifiers and timestamps in shared metadata. We do not share a mapping connecting you or your IP address to a query or its results.

This sharing concerns catalog metadata.

### Public availability

Published metadata may be copied and reused by independent recipients. Copies already distributed may remain with those recipients after a record is changed or removed from our database.

## 5. Infrastructure and operational monitoring

We use Cloudflare to protect and deliver the hosted service. Cloudflare processes connection information, including IP addresses, request URLs, headers, timestamps, and security events. Request URLs may contain search terms.

Infrastructure and security logs, including any IP addresses or clear-text search terms they contain, are kept separate from the metadata database and deleted within 7 days. They are used for operation and abuse prevention, rather than to create personal search profiles, and are not included in shared metadata. Further information is available in [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

Operational monitoring processes technical information such as response times, status codes, provider availability, cache outcomes, and errors. These operational records are retained for no more than 7 days and are not part of the shared metadata database.

## 6. Purposes and legal bases

Where personal data is involved, we rely on Article 6(1)(f) GDPR for the following legitimate interests, balanced against the rights of affected people:

- Providing searches, caching responses, and improving metadata quality.
- Maintaining availability, diagnosing faults, and protecting the service against abuse.
- Maintaining and sharing useful bibliographic information through an open-source metadata database.
- Responding to support and privacy enquiries.

Processing required to meet a legal obligation, including applicable data protection obligations, is based on Article 6(1)(c) GDPR.

Providing search and connection data is voluntary, but we cannot answer a request without processing the information needed to deliver it. We do not make automated decisions with legal or similarly significant effects on users under Article 22 GDPR.

## 7. Recipients and international processing

Recipients may include infrastructure and security providers, the metadata sources needed to answer a request, and recipients of shared catalog metadata. The information each receives is described in sections 3–5.

## 8. Retention and deletion

We retain data according to its purpose:

- **Hashed search-cache keys and cached results:** retained according to cache expiry and pruning policies. Queries are hashed from the outset
- **Catalog metadata:** for the continuing operation and development of the metadata database. Personal data is corrected or deleted when required by law or no longer needed for a lawful purpose.
- **Infrastructure, security, and operational logs, including any clear-text search queries and IP addresses:** no more than 7 days.
- **Support and privacy correspondence:** while needed to handle the enquiry and meet applicable legal obligations.

Metadata is not subject to a general fixed deletion period. This does not override the GDPR's requirements to limit the retention of personal data. Independent recipients may retain copies of publicly shared metadata under their own responsibility.

## 9. Your rights

Subject to the applicable legal conditions, you have the following rights under the GDPR:

- Access to your personal data and information about its processing.
- Correction of inaccurate data and deletion of personal data.
- Restriction of processing and data portability, where applicable.
- Objection under Article 21 GDPR to processing based on legitimate interests, for reasons relating to your particular situation.

Please use the contact details in our [Imprint](https://vito0912.de/impressum/) to make a request. We normally respond within one month, subject to the GDPR's permitted extensions.

You may complain to a data protection supervisory authority, including the authority where you live or work or where an alleged infringement occurred. You do not need to contact us first. Further information is available in the [German supervisory authority's guidance](https://www.datenschutz.sachsen.de/informationspflichten.html).

## 10. Self-hosting

Use of our hosted service is optional. You can [self-host abs-agg](README.md#quick-start) and control your own database, logging, and provider configuration.

Self-hosting does not automatically contribute your database to our hosted service. Requests your instance makes to external metadata providers remain subject to their processing practices. Each instance's operator is responsible for its own data processing and privacy information.

## 11. Changes to this policy

We update this policy when our processing practices change. The date above identifies the current revision.
