/**
 * API Client V2 — Incident-Aware Traffic Operations Command Center
 */

const BASE = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "http://localhost:4000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  // 204 No Content has empty body
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────

export interface EventEnvelope {
  event_id: string;
  correlation_id: string;
  schema_version: number;
  source_id: string;
  timestamp: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface Camera {
  id: string;
  cameraCode: string;
  name: string;
  location: string;
  intersectionId?: string;
  latitude?: number;
  longitude?: number;
  speedLimitKmh: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Penalty {
  id: string;
  event_id: string;
  camera_id: string;
  vehicle_plate: string;
  speed_kmh: number;
  speed_limit_kmh: number;
  fine_amount: number;
  status: string;
  issued_at: string;
}

export interface AuditLog {
  id: string;
  event_id: string;
  event_type: string;
  message: string;
  payload_snapshot: string | null;
  created_at: string;
}

export interface DashboardSnapshot {
  id: string;
  camera_id: string;
  intersection_name: string;
  vehicle_count: number;
  congestion_level: string;
  last_event_type: string;
  updated_at: string;
}

export interface ReportAggregate {
  id: string;
  event_type: string;
  camera_id: string;
  date_window: string;
  count: number;
}

export interface SubscriberInfo {
  name: string;
  supportedEventTypes: string[];
  activeEventTypes?: string[];
  processedCount: number;
  duplicateIgnoredCount: number;
}

export interface OperatorAction {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string;
  message: string;
  createdAt: string;
}

export interface ExternalSnapshot {
  id: string;
  provider: string;
  areaName: string;
  latitude: number | null;
  longitude: number | null;
  snapshotType: string;       // "FLOW" | "INCIDENT"
  riskLevel: string;
  summary: string;
  fallback: boolean;
  fetchedAt: string;
}

export interface FloodTestResult {
  published: number;
  accepted: number;
  evicted: number;
  finalQueueSize: number;
  queueLimit: number;
  policyName: string;
  breakdown: Record<string, { generated: number; accepted: number; evicted: number }>;
}

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

export interface DuplicateProof {
  event_id: string;
  published_attempts: number;
  penalties_created_for_event: number;
  duplicate_ignored_by_alert: number;
  penalty: Penalty | null;
}

export interface PublishPayload {
  source_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  correlation_id?: string;
}

export interface QueueAnalysis {
  incomingRate: number;
  processingRate: number;
  backlogGrowthPerSecond: number;
  queueLimit: number;
  secondsUntilFull: number;
  evictionPolicy: string;
  policyName?: string;
  policyId?: string | null;
  configurable?: boolean;
}

export interface SummaryResponse {
  cameraCount: number;
  intersectionCount: number;
  eventCount: number;
  activeAlertCount: number;
  violationCount: number;
  penaltyCount: number;
  serviceCount: number;
  congestionCount: number;
  openIncidentCount: number;
  criticalIncidentCount: number;
  incidentCount: number;
  latestEvents: EventEnvelope[];
  latestIncident: TrafficIncident | null;
  latestPenalty: Penalty | null;
  activeZone: { id: string; name: string; city: string } | null;
  queueRisk: string;
  queueSecondsUntilFull: number;
  externalProviderStatus: string;
}

export interface TrafficIncident {
  id: string;
  intersection_name: string;
  incident_type: string;
  severity: string;
  status: string;
  first_event_id: string;
  last_event_id: string;
  event_count: number;
  external_confirmed: boolean;
  external_context_summary?: string;
  opened_at: string;
  updated_at: string;
  acknowledged_at?: string;
  cleared_at?: string;
  events?: IncidentEvent[];
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  eventId: string;
  eventType: string;
  severity: string;
  createdAt: string;
}

export interface OutboxStatus {
  pendingCount: number;
  publishedCount: number;
  failedCount: number;
  relayRunning: boolean;
}

export interface ExternalContextStatus {
  provider: string;
  connected: boolean;
  fallback: boolean;
  keyConfigured: boolean;
  activeZone: { name: string; city: string } | null;
  area: string;
  lastChecked: string | null;
  lastStatus: string;
  message: string;
}

export interface TrafficRisk {
  overallRisk: string;
  reasons: string[];
  recommendation: string;
  externalProviderStatus: string;
  queueSecondsUntilFull: number;
  openIncidentCount: number;
  criticalIncidentCount: number;
  fallback: boolean;
  weather?: { severity: string; condition: string; temperatureC: number | null; fallback: boolean };
  tomtom?: { available: boolean; severity: "CLEAR" | "MODERATE" | "POOR"; incidentCount: number; summary: string };
}

export interface AlertTemplate {
  id: string;
  name: string;
  eventType: string;
  description: string;
  defaultPayload: string;
  severityHint?: string;
  active: boolean;
}

export interface OperationZone {
  id: string;
  name: string;
  city: string;
  country: string;
  centerLatitude: number;
  centerLongitude: number;
  externalProviderEnabled: boolean;
}

export interface Intersection {
  id: string;
  zoneId: string;
  name: string;
  roadName?: string;
  latitude: number;
  longitude: number;
  defaultSpeedLimit: number;
  congestionThreshold: number;
  status: string;
}

export interface QueuePolicy {
  id: string;
  name: string;
  incomingRate: number;
  processingRate: number;
  queueLimit: number;
  evictionPolicy: string;
  active: boolean;
}

export interface SeverityPolicyConfig {
  id: string;
  name: string;
  eventType: string;
  payloadField: string;
  lowThreshold?: number;
  mediumThreshold?: number;
  highThreshold?: number;
  criticalThreshold?: number;
  active: boolean;
}

export interface IncidentRuleConfig {
  id: string;
  name: string;
  incidentType: string;
  eventType: string;
  groupingWindowMinutes: number;
  minimumEvents: number;
  escalationThreshold: number;
  autoClearEventType?: string;
  active: boolean;
}

export interface ExternalProviderConfig {
  id?: string;
  provider: string;
  enabled: boolean;
  zoneId?: string | null;
  zone?: { id: string; name: string; city?: string } | null;
  keyConfigured?: boolean;
  lastStatus?: string;
  lastCheckedAt?: string | null;
}

export interface FinePolicy {
  id: string;
  name: string;
  eventType: string;
  excessThresholdKmh: number;
  fineAmount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WeatherStatus {
  provider: "OPEN-METEO" | "FALLBACK";
  connected: boolean;
  fallback: boolean;
  keyConfigured: boolean;
  city: string | null;
  temperatureC: number | null;
  feelsLikeC: number | null;
  condition: string;
  conditionCode: number | null;
  visibilityMeters: number | null;
  windSpeedKmh: number | null;
  humidityPct: number | null;
  severity: "CLEAR" | "MODERATE" | "POOR";
  message: string;
  fetchedAt: string;
}

export interface OutboxItem {
  id: string;
  event_id: string;
  envelope_json: string;
  status: "PENDING" | "PUBLISHED" | "FAILED";
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  published_at: string | null;
}

export interface SystemMetrics {
  eventsLast60s: number;
  eventsPerSecond: number;
  outbox: {
    pendingCount: number;
    publishedCount: number;
    failedCount: number;
    relayRunning: boolean;
    relayLastTickAt: string | null;
    relayPublishedTotal: number;
    relayFailedTotal: number;
  };
  duplicatesIgnoredTotal: number;
  subscribers: { name: string; processedCount: number; duplicateIgnoredCount: number }[];
  registeredEventTypes: string[];
  capturedAt: string;
}

// ─── API Calls ────────────────────────────────────────────────

export const api = {
  // Original CEP endpoints
  health:          ()                       => get<HealthResponse>("/api/health"),
  cameras:         ()                       => get<Camera[]>("/api/cameras"),
  events:          ()                       => get<EventEnvelope[]>("/api/events"),
  subscribers:     ()                       => get<SubscriberInfo[]>("/api/subscribers"),
  penalties:       ()                       => get<Penalty[]>("/api/penalties"),
  auditLogs:       ()                       => get<AuditLog[]>("/api/audit-logs"),
  reports:         ()                       => get<ReportAggregate[]>("/api/reports"),
  dashboard:       ()                       => get<DashboardSnapshot[]>("/api/dashboard"),
  queueAnalysis:   ()                       => get<QueueAnalysis>("/api/queue/analysis"),
  summary:         ()                       => get<SummaryResponse>("/api/summary"),
  incidents:       (status?: string)        => get<TrafficIncident[]>(`/api/incidents${status ? `?status=${status}` : ""}`),
  incident:        (id: string)             => get<TrafficIncident>(`/api/incidents/${id}`),
  outboxStatus:    ()                       => get<OutboxStatus>("/api/outbox/status"),
  relayOutbox:     ()                       => post<{ relayed: number; failed: number; skipped: number }>("/api/outbox/relay-once"),
  publishEvent:    (body: PublishPayload)   => post<{ envelope: EventEnvelope; summary: string }>("/api/events/publish", body),
  publishDuplicate:()                       => post<DuplicateProof>("/api/events/publish-duplicate-speed-violation"),

  // V2 Incident actions
  acknowledgeIncident: (id: string)         => post<TrafficIncident>(`/api/incidents/${id}/acknowledge`),
  closeIncident:       (id: string)         => post<TrafficIncident>(`/api/incidents/${id}/close`),

  // V2 External traffic
  externalStatus:  ()                       => get<ExternalContextStatus>("/api/external/context-status"),
  trafficRisk:     ()                       => get<TrafficRisk>("/api/traffic-risk"),

  // V2 Configuration
  zones:           ()                       => get<OperationZone[]>("/api/config/zones"),
  intersections:   ()                       => get<Intersection[]>("/api/config/intersections"),
  alertTemplates:  ()                       => get<AlertTemplate[]>("/api/config/alert-templates"),
  severityPolicies:()                       => get<SeverityPolicyConfig[]>("/api/config/severity-policies"),
  incidentRules:   ()                       => get<IncidentRuleConfig[]>("/api/config/incident-rules"),
  queuePolicies:   ()                       => get<QueuePolicy[]>("/api/config/queue-policies"),
  externalProvider:()                       => get<ExternalProviderConfig>("/api/config/external-provider"),

  // V2 Config mutations
  createCamera:        (body: Partial<Camera>)                     => post<Camera>("/api/cameras", body),
  updateCamera:        (id: string, body: Partial<Camera>)         => put<Camera>(`/api/cameras/${id}`, body),
  createIntersection:  (body: Partial<Intersection>)               => post<Intersection>("/api/config/intersections", body),
  updateIntersection:  (id: string, body: Partial<Intersection>)   => put<Intersection>(`/api/config/intersections/${id}`, body),
  createAlertTemplate: (body: Partial<AlertTemplate>)              => post<AlertTemplate>("/api/config/alert-templates", body),
  updateAlertTemplate: (id: string, body: Partial<AlertTemplate>)  => put<AlertTemplate>(`/api/config/alert-templates/${id}`, body),
  updateQueuePolicy:   (id: string, body: Partial<QueuePolicy>)    => put<QueuePolicy>(`/api/config/queue-policies/${id}`, body),

  // V3 Fine Policy (user-driven fines)
  finePolicies:      ()                                            => get<FinePolicy[]>("/api/config/fine-policies"),
  createFinePolicy:  (body: Partial<FinePolicy>)                   => post<FinePolicy>("/api/config/fine-policies", body),
  updateFinePolicy:  (id: string, body: Partial<FinePolicy>)       => put<FinePolicy>(`/api/config/fine-policies/${id}`, body),
  deleteFinePolicy:  (id: string)                                  => del<void>(`/api/config/fine-policies/${id}`),

  // V3 Weather
  weather:           ()                                            => get<WeatherStatus>("/api/weather"),

  // V3 Outbox browser + replay
  outboxList:        (status?: string, limit = 100)                => get<OutboxItem[]>(`/api/outbox${status ? `?status=${status}&limit=${limit}` : `?limit=${limit}`}`),
  replayOutboxRow:   (id: string)                                  => post<{ status: string; event_id?: string; error?: string }>(`/api/outbox/relay-one/${id}`),

  // V3 Metrics
  metrics:           ()                                            => get<SystemMetrics>("/api/metrics"),

  // V3 Subscriber subscribe / unsubscribe demo (CEP Task 2)
  subscribeTo:                (name: string, eventType: string)    => post<{ ok: boolean; activeEventTypes: string[] }>(`/api/subscribers/${encodeURIComponent(name)}/subscribe`, { eventType }),
  unsubscribeFrom:            (name: string, eventType: string)    => del<{ ok: boolean; activeEventTypes: string[] }>(`/api/subscribers/${encodeURIComponent(name)}/subscribe?eventType=${encodeURIComponent(eventType)}`),
  restoreSubscriberDefaults:  ()                                   => post<{ ok: boolean }>("/api/subscribers/restore-defaults"),

  // V3 Flood test (CEP Scenario 2)
  floodTest:         (count: number, queueLimit?: number)          => post<FloodTestResult>("/api/queue/flood-test", queueLimit != null ? { count, queueLimit } : { count }),

  // V3 Admin — wipe runtime tables, keep config (lets the user prove data provenance live)
  resetRuntimeData:  ()                                            => post<{ ok: boolean; cleared: Record<string, number> }>("/api/admin/reset-runtime-data"),

  // V3 Operator actions audit (every high-signal mutation)
  operatorActions:   (limit = 200)                                 => get<OperatorAction[]>(`/api/operator-actions?limit=${limit}`),

  // V3 External traffic snapshots (TomTom flow + incidents history)
  externalSnapshots: (limit = 20)                                  => get<ExternalSnapshot[]>(`/api/external/snapshots?limit=${limit}`),
};
