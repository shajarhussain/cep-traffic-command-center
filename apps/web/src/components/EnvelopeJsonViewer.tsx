interface EnvelopeJsonViewerProps {
  envelope: {
    event_id: string;
    correlation_id: string;
    schema_version: number;
    source_id: string;
    timestamp: string;
    event_type: string;
    payload: Record<string, unknown>;
  };
  compact?: boolean;
}

/**
 * Displays all 7 EventEnvelope fields in a structured visual.
 * Used for detailed metadata inspection — each field is labeled and clearly separated.
 */
export function EnvelopeJsonViewer({ envelope, compact = false }: EnvelopeJsonViewerProps) {
  const fields = [
    { name: "event_id",       value: envelope.event_id },
    { name: "correlation_id", value: envelope.correlation_id },
    { name: "schema_version", value: String(envelope.schema_version) },
    { name: "source_id",      value: envelope.source_id },
    { name: "timestamp",      value: envelope.timestamp },
    { name: "event_type",     value: envelope.event_type },
  ];

  if (compact) {
    return (
      <div className="json-viewer" style={{ fontSize: "11px" }}>
        {JSON.stringify(envelope, null, 2)}
      </div>
    );
  }

  return (
    <div>
      <div className="envelope-fields">
        {fields.map((f) => (
          <div key={f.name} className="envelope-field">
            <div className="envelope-field-name">{f.name}</div>
            <div className="envelope-field-value">{f.value}</div>
          </div>
        ))}
        <div className="envelope-field field-7-metadata">
          <div className="envelope-field-name">payload</div>
          <div className="envelope-field-value" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(envelope.payload, null, 2)}
          </div>
        </div>
      </div>
      <div className="mt-8 text-muted" style={{ fontSize: "11px", textAlign: "right" }}>
        ↑ All 7 required fields displayed
      </div>
    </div>
  );
}
