# Bulk Promotional Email Dashboard — Design Logic

This document divides the project into implementation phases with detailed steps. It aligns with the requirements in `README.md`.

**Note on Phase 1 transport:** The README frontmatter mentions SMTP for the MVP; the main specification describes third-party ESP APIs (SendGrid, Mailgun, AWS SES, Postmark). Phase 1 should deliver *working outbound mail*—either SMTP or one ESP—then converge on ESP APIs for rate limits, webhooks, and production-scale sending.

---

## Phase 1 — MVP

**Goal:** CSV import, contact dashboard with selection and filters, bulk sending (SMTP or single ESP), unsubscribe handling, suppression basics, and send log.

### 1. Foundation

1. Choose stack (e.g. React/Vite or Next.js + Node or Python API + SQLite or PostgreSQL).
2. Add configuration for public app base URL (unsubscribe links), database URL, and mail credentials (SMTP or ESP API key).
3. Define minimal persistence: `ContactList`, `Contact` (email, name, optional JSON custom fields, status default `active`, timestamps), `Campaign`, `CampaignRecipient` (or equivalent send rows), settings storage for SMTP or `EspConfig`.

### 2. CSV import

1. File upload endpoint and CSV parsing (enforce sensible size limits).
2. Auto-detect email column; support manual column mapping in the UI when detection fails.
3. Validate email format per row; surface malformed rows in preview summary.
4. Deduplicate within the file and against existing data; warn with counts.
5. Preview API and UI table; on confirm, persist list name/metadata and contacts under a `ContactList`.

### 3. Contact dashboard

1. Paginated list API with sorting by name, email, and date added.
2. Real-time search filter on name and email.
3. Status filter at minimum: `active` and `unsubscribed` (unsubscribed populated once unsubscribe flow exists).
4. Row checkbox, select-all on current page, and visible selected count.
5. If feasible in MVP: “select all matching current filters” backed by bulk selection semantics on the server.

### 4. Minimal campaign and composition

1. Create campaign with name, subject, body (plain HTML textarea is acceptable in Phase 1), sender display name and reply-to as required.
2. Attach recipients from the current dashboard selection when launching a send.
3. Pre-send compliance summary: counts excluded for unsubscribed/suppressed contacts when those subsystems exist.

### 5. Sending

1. Implement one delivery path: SMTP or a single ESP SDK.
2. Use a queue or background worker (in-process queue acceptable for local MVP) with batched sends and basic retry on transient failures.
3. Record per-recipient state: queued, sent, failed, error message, timestamps.

### 6. Compliance (MVP minimum)

1. Global suppression list; check it before enqueueing each recipient.
2. Signed or tokenized unsubscribe URL per recipient; public HTTP handler marks the contact unsubscribed and optionally adds the address to suppression.
3. Append footer text from settings (company name and physical address placeholder for CAN-SPAM-style compliance).

### 7. Send log UI

1. Campaign detail view: totals, failures, and simple progress if sends are asynchronous.
2. Auditable record of send attempts per contact (`CampaignRecipient` or equivalent).

### Phase 1 exit criteria

- Import with preview and confirm works end-to-end.
- Dashboard pagination, search, selection, and send pipeline work.
- Unsubscribe updates stored state and future sends respect it.
- Suppression prevents delivery.
- Send outcomes are logged and visible.

---

## Phase 2 — Templates, scheduling, bounces, tracking

**Goal:** Reusable templates with personalization, draft and scheduled campaigns, bounce handling via ESP webhooks, and open/click tracking (toggleable).

### 1. Templates

1. Introduce `EmailTemplate`: name, category, subject, HTML body, plain-text body, last modified.
2. CRUD UI including duplicate and delete.
3. Server-side token rendering (for example `{{first_name}}`, `{{company}}`) against contact fields; warn or validate unknown tokens.
4. Plain-text part: auto-generate from HTML with optional manual override.
5. “Send test to myself”: render with a sample contact and send a single message through the existing transport.

### 2. Campaign lifecycle

1. Status model: draft, scheduled, sending, completed, cancelled or failed as needed.
2. Scheduler: persist `scheduled_at` with timezone from settings; worker picks due campaigns safely (idempotent locks).
3. Recipient preview endpoint: resolved recipients plus excluded addresses with reasons.

### 3. ESP integration hardening

1. Provider abstraction: shared interface plus per-provider adapters.
2. Respect rate limits with configurable batch size and delay between batches.
3. Pause, cancel, and progress reporting for in-flight jobs (polling, SSE, or WebSocket).

### 4. Bounce handling

1. Webhook endpoints per ESP with signature verification where supported.
2. Map webhook events to hard and soft bounce flags on contacts; suppress or exclude hard bounces from future sends.
3. Show bounce metrics on campaign views.

### 5. Open and click tracking

1. Wrap outbound links through a redirect endpoint that logs clicks then forwards to the destination.
2. Embed a unique tracking pixel URL per message for opens; document limitations (blockers, prefetch) in settings or UI.
3. Settings flag to disable tracking for privacy or testing.

### Phase 2 exit criteria

- Campaigns can use saved templates with working personalization.
- Scheduled sends fire correctly in the configured timezone.
- Bounces update contact and campaign-level stats.
- Opens and clicks are recorded when tracking is enabled.

---

## Phase 3 — Groups/tags, analytics, A/B testing, multi-user, imports

**Goal:** Audience segmentation, richer analytics and exports, optional A/B tests, role-based access, and additional import sources.

### 1. Groups and tags

1. Schema for tags and contact-tag associations; optional distinct groups if not modeled as tags alone.
2. UI for assigning and removing tags in bulk; dashboard filters by tag or group.
3. Campaign targeting: entire tag or group intersected with compliance exclusions.

### 2. Advanced analytics

1. Home dashboard summary cards: total contacts, campaigns sent in period, average open rate.
2. Per-campaign analytics: CTR, funnel metrics, timeline of opens and clicks over a window such as seven days after send.
3. Per-contact activity history across campaigns.
4. Export campaign reports to CSV and PDF.

### 3. A/B testing (nice-to-have)

1. Variant definitions on a campaign (for example two subjects); deterministic split per recipient (for example hash-based 50/50).
2. Comparative reporting between variants.

### 4. Multi-user access and audit

1. User accounts and roles: Admin, Editor, Viewer (exact permissions tuned to your policy).
2. Enforce authorization on APIs and UI routes.
3. Audit log for imports, sends, settings changes, and other sensitive actions.

### 5. Additional import formats

1. Excel `.xlsx` import alongside CSV using the same mapping and preview flow.
2. Read-only database import for SQLite file upload and connection-string access to PostgreSQL or MySQL.
3. Optional merge-into-existing-list behavior with explicit duplicate-handling rules.

### Phase 3 exit criteria

- Tags or groups integrated into dashboard and campaign targeting.
- Analytics and exports meet README expectations for reporting depth.
- A/B flows complete if that scope is accepted.
- RBAC and audit trail operational for internal governance.
- Extra import paths stable (optionally behind feature flags).

---

## Cross-cutting practices (all phases)

- Version schema with migrations; avoid ad-hoc production DDL.
- Automated tests around import validation, unsubscribe handling, token rendering, and webhook signature verification.
- Keep API keys and secrets server-side only; never return full secrets to the client after save (masked display only).
