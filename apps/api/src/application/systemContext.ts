import type { PrismaClient } from "@prisma/client";
import { EventBus } from "../domain/bus/EventBus.js";
import { AlertService } from "../domain/subscribers/AlertService.js";
import { LoggingService } from "../domain/subscribers/LoggingService.js";
import { DashboardService } from "../domain/subscribers/DashboardService.js";
import { ReportingService } from "../domain/subscribers/ReportingService.js";
import { IncidentService } from "../domain/subscribers/IncidentService.js";
import { PrismaProcessedEventRepository } from "../infrastructure/repositories/ProcessedEventRepository.js";
import { PrismaPenaltyRepository } from "../infrastructure/repositories/PenaltyRepository.js";
import { PrismaAuditLogRepository } from "../infrastructure/repositories/AuditLogRepository.js";
import { PrismaDashboardRepository } from "../infrastructure/repositories/DashboardRepository.js";
import { PrismaReportRepository } from "../infrastructure/repositories/ReportRepository.js";
import { PrismaEventRepository } from "../infrastructure/repositories/EventRepository.js";
import { PrismaOutboxRepository } from "../infrastructure/repositories/OutboxRepository.js";
import { bootstrapSubscribers } from "./bootstrapSubscribers.js";
import { CameraSimulator } from "./CameraSimulator.js";
import { PublishEventUseCase } from "./PublishEventUseCase.js";
import { DuplicateSpeedViolationUseCase } from "./DuplicateSpeedViolationUseCase.js";
import { OutboxRelay } from "./OutboxRelay.js";
import { TomTomPoller } from "./TomTomPoller.js";
import { PrismaFinePolicyRepository } from "../infrastructure/repositories/FinePolicyRepository.js";
import { PrismaOperatorActionRepository } from "../infrastructure/repositories/OperatorActionRepository.js";
import defaultPrisma from "../infrastructure/prisma.js";
import { BoundedEventQueue } from "../domain/bus/BoundedEventQueue.js";

export interface SystemContext {
  prisma: PrismaClient;
  eventBus: EventBus;
  eventRepo: PrismaEventRepository;
  penaltyRepo: PrismaPenaltyRepository;
  auditLogRepo: PrismaAuditLogRepository;
  dashboardRepo: PrismaDashboardRepository;
  reportRepo: PrismaReportRepository;
  outboxRepo: PrismaOutboxRepository;
  processedRepo: PrismaProcessedEventRepository;
  finePolicyRepo: PrismaFinePolicyRepository;
  operatorActionRepo: PrismaOperatorActionRepository;
  alertService: AlertService;
  loggingService: LoggingService;
  dashboardService: DashboardService;
  reportingService: ReportingService;
  incidentService: IncidentService;
  cameraSimulator: CameraSimulator;
  publishUseCase: PublishEventUseCase;
  duplicateUseCase: DuplicateSpeedViolationUseCase;
  outboxRelay: OutboxRelay;
  tomTomPoller: TomTomPoller;
  startBackgroundWorkers: () => void;
  stopBackgroundWorkers: () => void;
}

export function createSystemContext(customPrisma?: PrismaClient): SystemContext {
  const prisma = customPrisma ?? defaultPrisma;
  const processedRepo = new PrismaProcessedEventRepository(prisma);
  const penaltyRepo = new PrismaPenaltyRepository(prisma);
  const auditLogRepo = new PrismaAuditLogRepository(prisma);
  const dashboardRepo = new PrismaDashboardRepository(prisma);
  const reportRepo = new PrismaReportRepository(prisma);
  const eventRepo = new PrismaEventRepository(prisma);
  const outboxRepo = new PrismaOutboxRepository(prisma);
  const finePolicyRepo = new PrismaFinePolicyRepository(prisma);
  const operatorActionRepo = new PrismaOperatorActionRepository(prisma);
  const eventBus = new EventBus();
  const boundedQueue = new BoundedEventQueue(10000);
  const alertService = new AlertService(processedRepo, penaltyRepo, finePolicyRepo);
  const loggingService = new LoggingService(processedRepo, auditLogRepo);
  const dashboardService = new DashboardService(processedRepo, dashboardRepo, boundedQueue);
  const reportingService = new ReportingService(processedRepo, reportRepo);
  const incidentService = new IncidentService(processedRepo, prisma);
  bootstrapSubscribers(eventBus, [alertService, loggingService, dashboardService, reportingService, incidentService]);
  const publishUseCase = new PublishEventUseCase(eventBus, eventRepo, outboxRepo, prisma);
  const duplicateUseCase = new DuplicateSpeedViolationUseCase(eventBus, eventRepo, penaltyRepo, alertService);
  const cameraSimulator = new CameraSimulator(publishUseCase, prisma);
  const outboxRelay = new OutboxRelay(outboxRepo, eventBus, {
    intervalMs:  parseInt(process.env["OUTBOX_RELAY_INTERVAL_MS"] ?? "1000", 10),
    batchSize:   parseInt(process.env["OUTBOX_RELAY_BATCH_SIZE"]  ?? "50", 10),
    maxAttempts: parseInt(process.env["OUTBOX_RELAY_MAX_ATTEMPTS"] ?? "5", 10),
  });
  const tomTomPoller = new TomTomPoller(prisma, {
    intervalMs: parseInt(process.env["TOMTOM_POLL_INTERVAL_MS"] ?? "300000", 10),
  });

  return {
    prisma, eventBus, eventRepo, penaltyRepo, auditLogRepo, dashboardRepo,
    reportRepo, outboxRepo, processedRepo, finePolicyRepo, operatorActionRepo,
    alertService, loggingService, dashboardService, reportingService, incidentService,
    cameraSimulator, publishUseCase, duplicateUseCase, outboxRelay, tomTomPoller,
    startBackgroundWorkers: () => { outboxRelay.start(); tomTomPoller.start(); dashboardService.start(); },
    stopBackgroundWorkers:  () => { outboxRelay.stop();  tomTomPoller.stop();  dashboardService.stop(); },
  };
}
