# Legal documents — pending items

Last reviewed: June 23, 2026

This file tracks what is **not yet complete** in the Cadenza landing-page legal docs (`terms.html`, `privacy.html`, and Spanish equivalents). Ask *"what's pending on legal?"* to get a status read from this file.

> **Not legal advice.** All drafted language requires review and approval by qualified legal counsel before you rely on it for compliance, app store submission, or litigation defense.

---

## Critical — do before relying on these docs

| # | Item | Status | Action required |
|---|------|--------|-----------------|
| 1 | **DMCA designated agent registration** | ⛔ Not done | Register at [copyright.gov/dmca-directory](https://www.copyright.gov/dmca-directory/) (~$6, renew every 3 years). After registration, update the agent name/address in Terms §5 (EN + ES). |
| 2 | **Attorney review of arbitration clause** | ⛔ Not reviewed | Terms §16 includes binding arbitration + class-action waiver. Enforceability varies by jurisdiction, user type (B2B vs consumer), and recent case law. Have counsel review before publish. |
| 3 | **Attorney review of full documents** | ⛔ Not reviewed | English drafts were expanded in-repo. Spanish (`es/`) versions are machine-assisted translations — counsel must review both languages. |
| 4 | **DMCA agent contact in Terms** | ⚠️ Placeholder | Terms currently list `info@cadenzaops.com` as the notification email. Confirm this inbox exists, is monitored, and matches your copyright.gov registration exactly. |

---

## App store & compliance alignment

| # | Item | Status | Action required |
|---|------|--------|-----------------|
| 5 | **Apple App Privacy labels** | ⛔ Not verified | Align App Store Connect privacy questionnaire with `privacy.html` §1 (data categories, linked to user, used for tracking, etc.). |
| 6 | **Google Play Data Safety form** | ⛔ Not verified | Align Play Console Data Safety section with `privacy.html`. Declare photo/camera, device IDs, account data, etc. |
| 7 | **CCPA/CPRA compliance program** | ⚠️ Policy only | Privacy §12 describes California rights. You still need operational processes: verify identity, respond within 45 days, honor opt-out if you ever "sell/share" data. |
| 8 | **Cookie consent banner** | ⛔ Not implemented | Privacy §11 states no advertising cookies today. If you add Google Analytics, Meta Pixel, or similar on the landing page, add a consent mechanism and update the policy. |

---

## Product-dependent — update when features change

| # | Item | Status | Action required |
|---|------|--------|-----------------|
| 9 | **AI disclosure** | ✅ Current state covered | Terms §12 and Privacy §13 state Cadenza does **not** currently use AI/ML for automated decisions. **Update both sections** if you ship AI features (recommendations, photo analysis, chat, etc.). |
| 10 | **Analytics / tracking** | ✅ Current state covered | Privacy §11 states no third-party advertising or analytics trackers on the landing page today. **Update** if you add Vercel Analytics, GA4, PostHog, Meta Pixel, etc. |
| 11 | **GPS / precise location** | ⚠️ Conditional | Privacy §1.4 notes GPS is collected only with explicit permission. If the mobile app begins collecting precise location by default, update §1.2, §1.4, and app store labels. |
| 12 | **User-generated content scope** | ✅ Partially covered | DMCA §5 covers photos and files technicians upload. If you add video, audio, PDF, or public sharing, expand acceptable-use and DMCA examples. |

---

## Email inboxes to set up

Ensure these addresses exist and are monitored:

| Address | Purpose |
|---------|---------|
| `info@cadenzaops.com` | General legal, dispute informal resolution |
| `info@cadenzaops.com` | Copyright takedown notices (DMCA) |
| `info@cadenzaops.com` | Privacy rights requests (access, delete, CCPA) |
| `info@cadenzaops.com` | Already referenced in Terms |

---

## What was added (June 23, 2026)

### Terms of Service (EN + ES)

- **§5** — Copyright and DMCA Policy (takedown procedure, counter-notice, repeat infringers)
- **§12** — Artificial Intelligence (current non-use + future update commitment)
- **§16** — Binding arbitration, class-action waiver, opt-out, small-claims carve-out (replaces courts-only language)
- Section renumbering (old §5–§16 → §6–§18)

### Privacy Policy (EN + ES)

- **§1.4** — Device permissions (camera, photo library, optional location)
- **§11** — Cookies and tracking technologies
- **§12** — California privacy rights (CCPA/CPRA)
- **§13** — Artificial intelligence and automated processing
- Section renumbering (old §11–§12 → §14–§15)

---

## Quick checklist before launch

- [ ] Register DMCA agent at copyright.gov
- [ ] Create and monitor `info@cadenzaops.com`
- [ ] Attorney signs off on EN Terms + Privacy
- [ ] Attorney signs off on ES Terms + Privacy (or mark ES as "translation for convenience only")
- [ ] Sync Apple App Privacy labels
- [ ] Sync Google Play Data Safety
- [ ] Update "Last updated" dates if counsel makes changes
