# Exact Project Structure Blueprint

Use this structure when asking Antigravity to create files.

```text
traffic-alert-cep/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  README.md
  .gitignore
  .env.example

  apps/
    api/
      package.json
      tsconfig.json
      src/
        main.ts
        app.ts
        domain/
          bus/
            EventBus.ts
            BoundedEventQueue.ts
          events/
            EventEnvelope.ts
            EventTypes.ts
            EventPriority.ts
            createEnvelope.ts
          subscribers/
            IEventSubscriber.ts
            BaseIdempotentSubscriber.ts
            AlertService.ts
            LoggingService.ts
            DashboardService.ts
            ReportingService.ts
        application/
          CameraSimulator.ts
          PublishEventUseCase.ts
          DuplicateSpeedViolationUseCase.ts
          bootstrapSubscribers.ts
        infrastructure/
          prisma.ts
          repositories/
            EventRepository.ts
            ProcessedEventRepository.ts
            PenaltyRepository.ts
            AuditLogRepository.ts
            DashboardRepository.ts
            ReportRepository.ts
            OutboxRepository.ts
        interfaces/
          http/
            camera.routes.ts
            event.routes.ts
            subscriber.routes.ts
            penalty.routes.ts
            log.routes.ts
            report.routes.ts
            queue.routes.ts
        tests/
          eventbus.spec.ts
          envelope.spec.ts
          idempotency.spec.ts
          bounded-queue.spec.ts
          fifth-event-type.spec.ts

    web/
      package.json
      tsconfig.json
      index.html
      src/
        main.tsx
        App.tsx
        api/
          client.ts
        components/
          StatusCard.tsx
          EventTypeBadge.tsx
          PriorityBadge.tsx
          CameraSimulatorForm.tsx
          EventTimelineTable.tsx
          EnvelopeJsonViewer.tsx
          SubscriberCard.tsx
          PenaltyTable.tsx
          AuditLogTable.tsx
          QueuePressureMeter.tsx
          ArchitectureDiagramPanel.tsx
        pages/
          OverviewPage.tsx
          CamerasPage.tsx
          EventsPage.tsx
          SubscribersPage.tsx
          PenaltiesPage.tsx
          LogsPage.tsx
          QueueLabPage.tsx
          ReportsPage.tsx
          ArchitecturePage.tsx
        styles/
          index.css

  packages/
    shared/
      package.json
      tsconfig.json
      src/
        index.ts
        event-contracts.ts
        api-contracts.ts

  prisma/
    schema.prisma
    seed.ts

  docs/
    00_REQUIREMENTS_TRACEABILITY.md
    01_ARCHITECTURE.md
    02_DATABASE_DESIGN.md
    03_UI_MODULES.md
    04_BACKEND_MODULES.md
    05_DESIGN_PATTERNS.md
    06_TEST_PLAN.md
    07_CLO4_ANALYSIS_ADR.md
    08_VIVA_NOTES.md

  .antigravity/
    ANTIGRAVITY_CONTEXT.md
    IMPLEMENTATION_PROMPTS.md
    AGENT_RULES.md
    MCP_SETUP.md
```

## Environment variables
```text
DATABASE_URL="file:./dev.db"
PORT=4000
WEB_ORIGIN="http://localhost:5173"
```

## Local commands
```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm test
```

## Milestone commits
```text
commit 1: initialize monorepo and docs
commit 2: add event contracts and envelope tests
commit 3: add observer event bus and tests
commit 4: add idempotent subscribers and duplicate penalty test
commit 5: add database schema and repositories
commit 6: add API routes
commit 7: add dashboard UI
commit 8: add queue lab and bounded queue tests
commit 9: finalize docs and viva notes
```
