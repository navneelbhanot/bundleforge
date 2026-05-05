/**
 * Tiny RFC-4180 CSV parser for bundle imports (M-069).
 *
 * Supports:
 *  - Comma delimiter, double-quote enclosure.
 *  - Doubled-quotes inside quoted fields.
 *  - CR, LF, or CRLF row terminators.
 *  - Trailing newline tolerance.
 *
 * Returns rows as `string[]` arrays. The first row is treated as the
 * header by `parseCsvWithHeaders`.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch === "\r") {
      // CRLF: skip, the next \n closes the row.
      // Plain CR: still close the row.
      if (text[i + 1] !== "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      }
    } else {
      cell += ch;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export interface CsvRecord {
  [key: string]: string;
}

export function parseCsvWithHeaders(text: string): CsvRecord[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    const rec: CsvRecord = {};
    for (let i = 0; i < header.length; i++) {
      rec[header[i]] = cells[i] ?? "";
    }
    return rec;
  });
}
