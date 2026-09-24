/**
 * Reads the BigQuery SQL from data/sql.md.
 * The file is plain SQL — no markdown fences required.
 */

import fs from 'fs';
import path from 'path';

export function loadSql(): string {
  const sqlPath = path.join(process.cwd(), 'data', 'sql.md');
  const content = fs.readFileSync(sqlPath, 'utf-8');

  // Strip markdown code fences if someone wraps it (```sql ... ```)
  const fenced = content.match(/```(?:sql)?\n([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : content.trim();
}
