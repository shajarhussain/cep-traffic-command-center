interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  mono?: boolean;
  truncate?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  emptyMessage?: string;
  emptyIcon?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  keyFn,
  emptyMessage = "No data yet.",
  emptyIcon = "📭",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">{emptyIcon}</div>
        <div>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyFn(row)}>
              {columns.map((col) => {
                const cellClass = [
                  col.mono ? "td-mono" : "",
                  col.truncate ? "td-truncate" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <td key={col.key} className={cellClass}>
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
