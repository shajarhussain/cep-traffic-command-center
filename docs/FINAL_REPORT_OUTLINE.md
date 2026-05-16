# Final Report Outline

> Event-Driven Traffic Alert System
> Software Design and Architecture — CEP

---

## Suggested Report Structure

Use this outline when writing the formal report. Each section maps to evidence already
in the repository.

---

### 1. Introduction (1 page)

- Project title and subject context
- Problem statement: smart traffic enforcement in Islamabad
- Summary of approach: Event-Driven Architecture with CEP patterns
- Tech stack summary

### 2. System Architecture (1–2 pages)

- High-level architecture diagram (see `docs/01_ARCHITECTURE.md`)
- Component overview: cameras → EventBus → 4 services → 7 repos → 8 DB tables
- Key design decisions: npm workspaces monorepo, Express 4, Prisma SQLite, Vitest

**Figures:**
- Figure 1: System component diagram
- Figure 2: Sequence diagram — event publish flow

### 3. Database Design (0.5 page)

- 8 Prisma models (see `docs/02_DATABASE_DESIGN.md`)
- Key constraints: `ProcessedEvent @@unique`, `Penalty @unique(eventId)`, `EventOutbox`

### 4. Design Patterns Implementation (2–3 pages)

#### 4.1 Observer Pattern
- `IEventSubscriber` interface
- `EventBus` with `Map<string, Set<IEventSubscriber>>`
- UML class diagram (see `docs/05_DESIGN_PATTERNS.md`)
- Evidence: subscriber monitor UI, `eventbus.spec.ts` (7 tests)

#### 4.2 Event Envelope Pattern
- 7 required CEP fields
- `createEnvelope()` factory
- Evidence: Event Inspector UI, `envelope.spec.ts` (9 tests), `POST /api/events/publish` response

#### 4.3 Idempotent Receiver Pattern
- `BaseIdempotentSubscriber` — Template Method
- `ProcessedEventRepository` — DB-level constraint
- Evidence: idempotency demo (2 → 1), `idempotency.spec.ts` (10 tests)
- Most important demo for viva

#### 4.4 Summary of patterns and why they are appropriate for traffic enforcement

### 5. CLO 4 Architectural Analysis (2–3 pages)

#### 5.1 Scenario 1 — Schema Evolution
- Option A vs Option B comparison
- ADR decision with justification
- Implementation evidence: `lane_number?`, `schema_version` field
- Full text from `docs/07_CLO4_ANALYSIS_ADR.md` Scenario 1

#### 5.2 Scenario 2 — Event Flood
- Calculation table: 500 in, 80 out, 420 backlog, 23.81s
- Bounded queue design and eviction policy
- Priority map table
- Evidence: `BoundedEventQueue.ts`, `bounded-queue.spec.ts`, `/api/queue/analysis`
- Full text from `docs/07_CLO4_ANALYSIS_ADR.md` Scenario 2

#### 5.3 Scenario 3 — Dual Write Problem
- Concrete failure example (penalty vs audit log)
- Outbox Pattern explanation and steps
- Cost vs benefit analysis
- Domain justification (legal enforcement)
- Evidence: `EventOutbox` schema, `OutboxRepository.ts`
- Full text from `docs/07_CLO4_ANALYSIS_ADR.md` Scenario 3

### 6. Testing Strategy (1 page)

- Test strategy overview (unit, integration, API)
- Test files and counts (see `docs/06_TEST_PLAN.md`)
- Final result: **78 / 78 tests passing**
- Verbatim output from `docs/evidence/TEST_OUTPUT.md`

**Table:** Test file mapping to CEP tasks

### 7. Dashboard UI (0.5–1 page)

- 10 pages implemented
- Camera Simulator, Idempotency Demo, Event Inspector, Subscriber Monitor
- Screenshots from `docs/evidence/screenshots/`

### 8. API Reference (0.5 page)

- Table of all 11 endpoints
- Key responses reproduced from `docs/evidence/API_RESPONSES.md`

### 9. Requirements Traceability (0.5 page)

- Summary table from `docs/00_REQUIREMENTS_TRACEABILITY.md`

### 10. Conclusion (0.5 page)

- What was achieved
- Design decisions that proved most valuable
- What would be next: Outbox relay, BoundedQueue wired into pipeline, PostgreSQL migration
- Reflection on Event-Driven Architecture for traffic systems

---

## Appendices

| Appendix | Content |
|---|---|
| A | Full test output (`docs/evidence/TEST_OUTPUT.md`) |
| B | Full API responses (`docs/evidence/API_RESPONSES.md`) |
| C | Prisma schema (`prisma/schema.prisma`) |
| D | Full CLO 4 analysis (`docs/07_CLO4_ANALYSIS_ADR.md`) |
| E | Viva notes (`docs/08_VIVA_NOTES.md`) |

---

## Word Count Targets

| Section | Words |
|---|---|
| Introduction | ~150 |
| Architecture | ~300 |
| Design Patterns | ~600 |
| CLO 4 Analysis | ~800 |
| Testing | ~200 |
| Conclusion | ~150 |
| **Total** | **~2,200** |
