// The learner's own data: a CSV file read in the browser. It is kept in memory only —
// never uploaded, never stored — so after a reload the file has to be opened again.
import { statsFrom, type GroupStats } from '../math/sem.ts';

export interface OwnData { name: string; columns: string[]; numeric: boolean[]; cells: string[][]; groupable: string[]; decimalComma: boolean }

let current: OwnData | null = null;
const listeners = new Set<() => void>();
export const ownData = () => current;
export function setOwnData(d: OwnData | null) { current = d; listeners.forEach(f => f()); }
export function onOwnData(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

const MISSING = new Set(['', 'na', 'nan', '.', 'null', '-99', '-999']);

/** Split CSV text (comma, semicolon or tab; quotes allowed). */
export function parseCsv(text: string, name: string): OwnData {
  const firstLine = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length);
  const delim = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  if (rows.length < 2) throw new Error('The file needs a header row and at least one row of data.');
  const columns = rows[0].map((c, i) => c.trim() || `V${i + 1}`);
  const cells = rows.slice(1).map(r => columns.map((_, i) => (r[i] ?? '').trim()));
  const decimalComma = delim === ';';
  const num = (s: string) => (MISSING.has(s.toLowerCase()) ? NaN : Number(decimalComma ? s.replace(',', '.') : s));
  const numeric = columns.map((_, j) => {
    const vals = cells.map(r => r[j]).filter(s => !MISSING.has(s.toLowerCase()));
    return vals.length > 0 && vals.every(s => Number.isFinite(num(s)));
  });
  const groupable = columns.filter((_, j) => {
    const levels = new Set(cells.map(r => r[j]).filter(s => !MISSING.has(s.toLowerCase())));
    return levels.size >= 2 && levels.size <= 12;
  });
  return { name, columns, numeric, cells, groupable, decimalComma };
}

/** Group statistics for the given variables (complete cases on exactly these variables). */
export function ownGroups(d: OwnData, vars: string[], grouping: string | null): GroupStats[] {
  const idx = vars.map(v => d.columns.indexOf(v));
  const num = (s: string) => (MISSING.has(s.toLowerCase()) ? NaN : Number(d.decimalComma ? s.replace(',', '.') : s));
  const rowsOf = (cells: string[][]) => cells.map(r => idx.map(i => num(r[i])));
  if (!grouping) return [statsFrom(rowsOf(d.cells), vars, d.name)];
  const g = d.columns.indexOf(grouping);
  const levels = [...new Set(d.cells.map(r => r[g]).filter(s => !MISSING.has(s.toLowerCase())))].sort();
  return levels.map(l => statsFrom(rowsOf(d.cells.filter(r => r[g] === l)), vars, `${grouping} = ${l}`));
}
