import { describe, it, expect } from 'vitest';
import { calculateSeverity } from '../src/domain/events/Severity';
import { EVENT_TYPES } from '../src/domain/events/EventTypes';
import type { EventEnvelope } from '../src/domain/events/EventEnvelope';

describe('SeverityHelper', () => {
  it('should return LOW for speed violation < 10 km/h over', () => {
    const env: EventEnvelope = {
      event_id: '1', correlation_id: '1', schema_version: 1, source_id: '1', timestamp: '',
      event_type: EVENT_TYPES.SpeedViolation,
      payload: { speed_kmh: 65, speed_limit_kmh: 60 }
    };
    expect(calculateSeverity(env)).toBe('LOW');
  });

  it('should return MEDIUM for speed violation 10-25 km/h over', () => {
    const env: EventEnvelope = {
      event_id: '2', correlation_id: '2', schema_version: 1, source_id: '2', timestamp: '',
      event_type: EVENT_TYPES.SpeedViolation,
      payload: { speed_kmh: 75, speed_limit_kmh: 60 }
    };
    expect(calculateSeverity(env)).toBe('MEDIUM');
  });

  it('should return HIGH for speed violation > 25 km/h over', () => {
    const env: EventEnvelope = {
      event_id: '3', correlation_id: '3', schema_version: 1, source_id: '3', timestamp: '',
      event_type: EVENT_TYPES.SpeedViolation,
      payload: { speed_kmh: 90, speed_limit_kmh: 60 }
    };
    expect(calculateSeverity(env)).toBe('HIGH');
  });

  it('should return congestion level for CongestionAlert', () => {
    const env: EventEnvelope = {
      event_id: '4', correlation_id: '4', schema_version: 1, source_id: '4', timestamp: '',
      event_type: EVENT_TYPES.CongestionAlert,
      payload: { congestion_level: 'CRITICAL' }
    };
    expect(calculateSeverity(env)).toBe('CRITICAL');
  });
});
