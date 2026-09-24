/**
 * BigQuery connector — same pattern as weekly-revenue-reporting.
 *
 * Credentials (one of):
 *   GCP_SERVICE_ACCOUNT_JSON   — service account JSON as a string (env var)
 *   GOOGLE_APPLICATION_CREDENTIALS — path to service account JSON file
 *
 * Also requires:
 *   GCP_PROJECT_ID             — GCP project ID
 */

import { BigQuery } from '@google-cloud/bigquery';

let client: BigQuery | null = null;

function getClient(): BigQuery {
  if (client) return client;

  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) throw new Error('GCP_PROJECT_ID is not set');

  if (process.env.GCP_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON);
    client = new BigQuery({ projectId, credentials });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    client = new BigQuery({ projectId });
  } else {
    throw new Error(
      'No BigQuery credentials configured. Set GCP_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  return client;
}

function normalizeValue(v: unknown): unknown {
  // BigQuery DATE/TIMESTAMP columns return {value: "..."} objects
  if (v && typeof v === 'object' && 'value' in (v as object)) {
    return (v as { value: unknown }).value;
  }
  if (v instanceof Date) return v.toISOString();
  return v;
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, normalizeValue(v)])
  );
}

/**
 * Run arbitrary SQL against BigQuery. Returns all rows as plain objects.
 * Column values are normalised: BigQuery date objects → ISO strings.
 */
export async function runQuery(sql: string): Promise<Record<string, unknown>[]> {
  const bq = getClient();
  const [rows] = await bq.query({ query: sql });
  return (rows as Record<string, unknown>[]).map(normalizeRow);
}
