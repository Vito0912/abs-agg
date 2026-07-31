# Privacy Policy

This Privacy Policy explains how data is collected, processed, and stored when you use our Search API service. We are committed to minimizing data collection and ensuring that search activity remains anonymous.

## 1. Data Collection & Usage

To operate and improve our service, our backend caches the following technical information for each request up to **2 years**:

- **Search Query Parameters:** Search title and search author
- **Backend Responses:** The response generated and returned by our backend system for that query

### Anonymity

**It is impossible to link these search logs to an individual user/ip** We do not store account details, personal identifiers, or metadata alongside search logs that could connect a search request to a specific person or IP address.

---

## 2. Infrastructure & Traffic Processing (Cloudflare)

We use **Cloudflare** as a reverse proxy, content delivery network (CDN), and security provider to protect our infrastructure against abuse and attacks.

- **IP Address Handling:** When you access our API, your request passes through Cloudflare. For security, anti-abuse, and operational monitoring, IP addresses may be **partially logged**.
- **Automatic Deletion:** IP address logs are **not stored permanently**. They are automatically deleted within **30 days**.

---

## 3. Data Retention

- **Search Logs (Title, Author, Response):** Stored for up to **2 years** in an aggregated/anonymous format solely for quality improvement, performance optimization, and debugging.
- **Network & Security Logs (IPs):** Retained by Cloudflare for up to 30 days maximum, after which they are automatically purged.

---

## 4. Contact

If you have questions regarding this Privacy Policy or our data handling practices, feel free to reach out to at the email in the GitHub profile.
