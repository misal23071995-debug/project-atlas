// CSV for spreadsheet export. Safe to import from Client Components.

export type Cell = string | number | null | undefined;

function escape(cell: Cell) {
  if (cell === null || cell === undefined) return "";
  const text = String(cell);
  // Stop spreadsheets treating text like "=SUM(...)" as a formula
  const safe = /^[=+\-@\t\r]/.test(text) && typeof cell === "string" ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  // The BOM makes Excel read the file as UTF-8, so ₹ and names with accents survive
  const blob = new Blob(["﻿" + toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
