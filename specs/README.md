# Spec-Driven Development (SDD)

This folder holds product/engineering specs for Cadenza work. **Write specs before (or with) code.** Customer-facing detail that must stay private lives in Jira, not here.

## Privacy (public repository)

Specs must **not** contain customer/client data: no customer company names, people names, customer lists, routes, addresses, interview notes, or business figures/counts. Do not read or cite private research dumps. Describe requirements generically (“a pool service company”) and link Jira for details: `https://agasocial.atlassian.net/browse/KAN-xxx`.

## Lifecycle

1. **Spec before code** (`spec.md`) — problem, scope / non-goals, requirements, numbered acceptance criteria (`AC-1`…`AC-n`, each testable), data model & API, edge cases.
2. **Technical plan + decisions** (`plan.md`, `decisions.md`) — approach; ADR-style log (context, options, decision, consequences).
3. **Tasks** (`tasks.md`) — checklist items linked to the Jira ticket.
4. **Implementation** — ship code with tests that map to each AC; keep an **AC → test** traceability table in `spec.md`.
5. **Close** — fill the **As built** section (what actually shipped, PR link, Jira link). Set status to **Built**.

## Folder convention

```
specs/KAN-xxx-short-name/
  spec.md
  plan.md
  decisions.md
  tasks.md
```

Copy from `specs/_template/` when starting a ticket.

## Status values

| Status | Meaning |
|--------|---------|
| **Draft** | Spec in progress; not ready to build against |
| **Approved** | Spec agreed; implementation may start |
| **In progress** | Implementation underway |
| **Built** | Merged / shipped enough to close the ticket (note any pending release) |

## Index

| Ticket | Folder | Title | Status |
|--------|--------|-------|--------|
| [KAN-147](https://agasocial.atlassian.net/browse/KAN-147) | [`KAN-147-free-plan-readonly/`](./KAN-147-free-plan-readonly/) | Free plan expiry → company read-only | Built |
| [KAN-148](https://agasocial.atlassian.net/browse/KAN-148) | [`KAN-148-billing-dunning/`](./KAN-148-billing-dunning/) | Billing dunning & payment-failure grace | Built |
| [KAN-151](https://agasocial.atlassian.net/browse/KAN-151) | [`KAN-151-customer-auto-reports/`](./KAN-151-customer-auto-reports/) | Automatic customer visit report emails | Built |
| [KAN-152](https://agasocial.atlassian.net/browse/KAN-152) | [`KAN-152-report-delivery-log/`](./KAN-152-report-delivery-log/) | Customer report delivery log & unsent view | Built |
| [KAN-165](https://agasocial.atlassian.net/browse/KAN-165) | [`KAN-165-voice-notes/`](./KAN-165-voice-notes/) | Voice notes on jobs, with transcription and classification | Built |
| [KAN-153](https://agasocial.atlassian.net/browse/KAN-153) | [`KAN-153-carry-forward/`](./KAN-153-carry-forward/) | Open-issue carry-forward on the next visit | Built |
| [KAN-154](https://agasocial.atlassian.net/browse/KAN-154) | [`KAN-154-monday-digest/`](./KAN-154-monday-digest/) | Monday digest of open issues | In progress |
