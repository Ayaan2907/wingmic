# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in wingmic, please report it privately. **Do not open a public GitHub issue.**

**Email:** `security@wingmic.xyz`

If you don't get an acknowledgement within 48 hours, ping `@Ayaan2907` directly via [GitHub](https://github.com/Ayaan2907) so we can route your report.

### What to include

- A description of the issue
- Steps to reproduce (smallest possible)
- The version / commit affected
- Your contact info so we can follow up
- (Optional) a proposed fix or mitigation

## Our commitment

- **Acknowledgement** within 48 hours of receipt
- **Initial assessment** within 7 days
- **Fix or mitigation** within 14 days for high-severity issues
- **Public disclosure** coordinated with you — we credit reporters in release notes unless you prefer to stay anonymous

## What is in scope

- The hosted `wingmic.xyz` deployment
- The published OSS code in this repository (`Ayaan2907/wingmic`)
- The official `@wingmic/*` npm packages (when they exist; v0.4+)

## What is out of scope

- Third-party services we depend on (Anthropic, OpenAI, Resend, Cloudflare, Turso) — please report those upstream.
- Self-hosted instances we don't operate. We'll happily review and patch class-of-bug fixes that affect self-hosted users, but operational security of your own deploy is yours.
- Theoretical attacks that require physical device access or compromised user credentials.
- DoS / rate-limit issues — these are operational, not security.

## Supported versions

Wingmic is in active beta. Only the latest minor version receives security updates.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ yes    |
| < 0.1   | ❌ no     |

## Sensitive data we touch

So you know the threat surface:

- **Voice transcripts** — sent to Anthropic for extraction. Stored in libSQL with full-text + embeddings. Scoped to the user who captured them.
- **Embeddings** — sent to OpenAI (text-embedding-3-small). 1536-d float arrays. Stored in libSQL.
- **People you capture** — names, roles, companies, free-form notes. Per-user, never cross-shared.
- **Magic-link tokens** — short-lived (10 min), single-use, in the `verification` table.
- **Sessions** — BetterAuth-managed, cookie-stored, in the `session` table.
- **Identity claims** (when v0.2 lands) — verified email / linkedin / etc. for opt-in linking.

Anything that touches the above with surprising read/write capability is a P0.

## Hall of fame

We credit confirmed reporters here. None yet — be the first.

## Encryption

We accept reports over plain email if that's what you have. If you prefer encrypted, our PGP key is published at `https://wingmic.xyz/.well-known/security.txt` (when the deploy lands).
