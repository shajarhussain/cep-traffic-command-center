/**
 * Lightweight CSV export helper. Client-side, no deps. Used by
 * Enforcement (penalties) and Audit (logs) tables.
 */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  // CSV quoting: wrap in quotes if it contains commas, quotes, or newlines; double-up internal quotes.
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv<T extends object>(rows: T[], columns?: (keyof T)[]): string {
  if (rows.length === 0) return "";
  const headers = (columns ?? (Object.keys(rows[0]!) as (keyof T)[])) as string[];
  const headerLine = headers.map(escapeCell).join(",");
  const bodyLines = rows.map(row => headers.map(h => escapeCell((row as Record<string, unknown>)[h])).join(","));
  return [headerLine, ...bodyLines].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRowsAsCsv<T extends object>(filename: string, rows: T[], columns?: (keyof T)[]): void {
  downloadCsv(filename, rowsToCsv(rows, columns));
}
