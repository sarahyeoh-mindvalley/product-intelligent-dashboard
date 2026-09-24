import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

const DB_DIR = process.env.VERCEL
  ? '/tmp/data'
  : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'cohorts.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // On Vercel cold start, seed from the bundled compressed database
  if (process.env.VERCEL && !fs.existsSync(DB_PATH)) {
    const seedPath = path.join(process.cwd(), 'seed', 'cohorts.db.gz');
    if (fs.existsSync(seedPath)) {
      const decompressed = zlib.gunzipSync(fs.readFileSync(seedPath));
      fs.writeFileSync(DB_PATH, decompressed);
    }
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');       // safe in WAL mode, much faster
  db.pragma('cache_size = -65536');        // 64 MB page cache
  db.pragma('temp_store = MEMORY');        // temp tables in RAM
  db.pragma('mmap_size = 268435456');      // 256 MB memory-mapped I/O
  db.pragma('wal_autocheckpoint = 2000');  // checkpoint every 2000 pages

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pipeline_run_id INTEGER NOT NULL,
      customer_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      purchased_at TEXT NOT NULL,
      FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs(id)
    );

    CREATE TABLE IF NOT EXISTS quest_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pipeline_run_id INTEGER NOT NULL,
      customer_id TEXT NOT NULL,
      quest_name TEXT NOT NULL,
      quest_category TEXT NOT NULL,
      completion_percentage REAL NOT NULL,
      last_activity_at TEXT NOT NULL,
      started_at TEXT NOT NULL,
      FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs(id)
    );

    CREATE TABLE IF NOT EXISTS engagement_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pipeline_run_id INTEGER NOT NULL,
      customer_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_source TEXT NOT NULL,
      event_count INTEGER NOT NULL DEFAULT 1,
      recorded_date TEXT NOT NULL,
      FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs(id)
    );

    CREATE TABLE IF NOT EXISTS subscription_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pipeline_run_id INTEGER NOT NULL,
      customer_id TEXT NOT NULL,
      tier_name TEXT NOT NULL,
      tier_level INTEGER NOT NULL,
      subscribed_since TEXT NOT NULL,
      renewal_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs(id)
    );

    CREATE TABLE IF NOT EXISTS rule_cohorts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      conditions TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feature_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      release_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('released','planned')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS release_cohort_impacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      release_id INTEGER NOT NULL,
      cohort_id TEXT NOT NULL,
      cohort_type TEXT NOT NULL CHECK(cohort_type IN ('ml','rule')),
      impact_score REAL NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('positive','negative','neutral')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (release_id) REFERENCES feature_releases(id)
    );
  `);

  seedFeatureReleases(db);
}

// ---------------------------------------------------------------------------
// Feature releases seed
// ---------------------------------------------------------------------------

function seedFeatureReleases(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM feature_releases').get() as { cnt: number }).cnt;
  if (count > 0) return; // already seeded

  const now = new Date();
  const daysAgo = (d: number) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - d);
    return dt.toISOString().slice(0, 10);
  };

  const releases = [
    {
      name: 'Quest Streak Reminders',
      description: 'Push and email reminders to maintain quest streaks, triggered after 2+ day gaps in progress.',
      release_date: daysAgo(82),
      status: 'released',
    },
    {
      name: 'Community Feed Redesign',
      description: 'Overhauled community feed with algorithmic ranking, topic filters, and improved media previews.',
      release_date: daysAgo(70),
      status: 'released',
    },
    {
      name: 'Offline Download Support',
      description: 'Allow learners to download quest videos for offline playback on iOS and Android.',
      release_date: daysAgo(58),
      status: 'released',
    },
    {
      name: 'Personalized Quest Recommendations',
      description: 'ML-driven quest recommendations on the home screen based on completion history and interests.',
      release_date: daysAgo(47),
      status: 'released',
    },
    {
      name: 'Live Session Calendar Integration',
      description: 'One-click add-to-calendar for live sessions across Google Calendar, Outlook, and Apple Calendar.',
      release_date: daysAgo(35),
      status: 'released',
    },
    {
      name: 'Progress Milestone Badges',
      description: 'Introduced achievement badges at 25%, 50%, 75%, and 100% quest completion milestones.',
      release_date: daysAgo(24),
      status: 'released',
    },
    {
      name: 'AI-Powered Journal Prompts',
      description: 'Daily journal prompts generated by AI based on the learner\'s current quest content and progress.',
      release_date: daysAgo(14),
      status: 'released',
    },
    {
      name: 'Peer Accountability Groups',
      description: 'Small group matching feature allowing learners to form accountability pods for shared quests.',
      release_date: daysAgo(6),
      status: 'released',
    },
  ];

  const insert = db.prepare(`
    INSERT INTO feature_releases (name, description, release_date, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: typeof releases) => {
    for (const r of items) {
      insert.run(r.name, r.description, r.release_date, r.status, now.toISOString());
    }
  });

  insertMany(releases);
}

export interface PipelineRunRow {
  id: number;
  run_date: string;
  completed_at: string;
  status: string;
  error_message: string | null;
}

export interface SourceCounts {
  purchase_history: number;
  quest_progress: number;
  engagement_signals: number;
  subscription_tiers: number;
}

export function getLatestPipelineRun(): PipelineRunRow | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM pipeline_runs
    WHERE status = 'success'
    ORDER BY completed_at DESC
    LIMIT 1
  `).get() as PipelineRunRow | undefined;
  return row ?? null;
}

export function getSourceCountsForRun(runId: number): SourceCounts {
  const db = getDb();
  const purchase = (db.prepare('SELECT COUNT(*) as cnt FROM purchase_history WHERE pipeline_run_id = ?').get(runId) as { cnt: number }).cnt;
  const quest = (db.prepare('SELECT COUNT(*) as cnt FROM quest_progress WHERE pipeline_run_id = ?').get(runId) as { cnt: number }).cnt;
  const engagement = (db.prepare('SELECT COUNT(*) as cnt FROM engagement_signals WHERE pipeline_run_id = ?').get(runId) as { cnt: number }).cnt;
  const subscription = (db.prepare('SELECT COUNT(*) as cnt FROM subscription_tiers WHERE pipeline_run_id = ?').get(runId) as { cnt: number }).cnt;

  return {
    purchase_history: purchase,
    quest_progress: quest,
    engagement_signals: engagement,
    subscription_tiers: subscription,
  };
}

export function getAllPipelineRuns(): PipelineRunRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM pipeline_runs ORDER BY completed_at DESC LIMIT 10
  `).all() as PipelineRunRow[];
}

export function getCumulativeSourceCounts(): SourceCounts {
  const db = getDb();
  const purchase = (db.prepare('SELECT COUNT(*) as cnt FROM purchase_history').get() as { cnt: number }).cnt;
  const quest = (db.prepare('SELECT COUNT(*) as cnt FROM quest_progress').get() as { cnt: number }).cnt;
  const engagement = (db.prepare('SELECT COUNT(*) as cnt FROM engagement_signals').get() as { cnt: number }).cnt;
  const subscription = (db.prepare('SELECT COUNT(*) as cnt FROM subscription_tiers').get() as { cnt: number }).cnt;

  return {
    purchase_history: purchase,
    quest_progress: quest,
    engagement_signals: engagement,
    subscription_tiers: subscription,
  };
}

// ---------------------------------------------------------------------------
// Rule-based cohorts
// ---------------------------------------------------------------------------

export interface CohortCondition {
  field: 'quest_completion_pct' | 'subscription_tier' | 'total_purchases' | 'days_since_activity' | 'event_count_30d';
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number | string;
}

export interface CohortRow {
  id: number;
  name: string;
  conditions: string; // JSON
  created_at: string;
  updated_at: string;
}

export interface Cohort {
  id: number;
  name: string;
  conditions: CohortCondition[];
  created_at: string;
  updated_at: string;
}

function parseCohort(row: CohortRow): Cohort {
  return {
    ...row,
    conditions: JSON.parse(row.conditions) as CohortCondition[],
  };
}

export function getAllCohorts(): Cohort[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM rule_cohorts ORDER BY created_at DESC').all() as CohortRow[];
  return rows.map(parseCohort);
}

export function getCohortById(id: number): Cohort | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM rule_cohorts WHERE id = ?').get(id) as CohortRow | undefined;
  return row ? parseCohort(row) : null;
}

export function createCohort(name: string, conditions: CohortCondition[]): Cohort {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO rule_cohorts (name, conditions, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(name, JSON.stringify(conditions), now, now);
  return getCohortById(result.lastInsertRowid as number)!;
}

export function updateCohort(id: number, name: string, conditions: CohortCondition[]): Cohort | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE rule_cohorts SET name = ?, conditions = ?, updated_at = ? WHERE id = ?
  `).run(name, JSON.stringify(conditions), now, id);
  return getCohortById(id);
}

export function deleteCohort(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM rule_cohorts WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Evaluate the member count for a rule-based cohort from live data.
 * Returns the count of distinct customer_ids that match ALL conditions.
 */
export function evaluateCohortMemberCount(conditions: CohortCondition[]): number {
  if (conditions.length === 0) return 0;

  const db = getDb();

  // Build a set of customer IDs from each condition, then intersect
  let matchSets: Set<string>[] = [];

  for (const cond of conditions) {
    const opMap: Record<string, string> = { gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '=' };
    const op = opMap[cond.operator] ?? '=';
    const val = Number(cond.value);

    let ids: string[] = [];

    switch (cond.field) {
      case 'quest_completion_pct': {
        const rows = db.prepare(`
          SELECT DISTINCT customer_id FROM quest_progress
          WHERE completion_percentage ${op} ?
        `).all(val) as { customer_id: string }[];
        ids = rows.map(r => r.customer_id);
        break;
      }
      case 'subscription_tier': {
        const rows = db.prepare(`
          SELECT DISTINCT customer_id FROM subscription_tiers
          WHERE tier_level ${op} ? AND is_active = 1
        `).all(val) as { customer_id: string }[];
        ids = rows.map(r => r.customer_id);
        break;
      }
      case 'total_purchases': {
        const rows = db.prepare(`
          SELECT customer_id FROM purchase_history
          GROUP BY customer_id
          HAVING SUM(amount) ${op} ?
        `).all(val) as { customer_id: string }[];
        ids = rows.map(r => r.customer_id);
        break;
      }
      case 'days_since_activity': {
        // Filter customers whose last quest activity was N+ days ago
        const rows = db.prepare(`
          SELECT customer_id FROM quest_progress
          GROUP BY customer_id
          HAVING CAST(julianday('now') - julianday(MAX(last_activity_at)) AS INTEGER) ${op} ?
        `).all(val) as { customer_id: string }[];
        ids = rows.map(r => r.customer_id);
        break;
      }
      case 'event_count_30d': {
        const rows = db.prepare(`
          SELECT customer_id FROM engagement_signals
          WHERE recorded_date >= datetime('now', '-30 days')
          GROUP BY customer_id
          HAVING SUM(event_count) ${op} ?
        `).all(val) as { customer_id: string }[];
        ids = rows.map(r => r.customer_id);
        break;
      }
    }

    matchSets.push(new Set(ids));
  }

  // Intersect all sets
  if (matchSets.length === 0) return 0;
  let result = matchSets[0];
  for (let i = 1; i < matchSets.length; i++) {
    result = new Set([...result].filter(id => matchSets[i].has(id)));
  }
  return result.size;
}

// ---------------------------------------------------------------------------
// Feature releases
// ---------------------------------------------------------------------------

export interface FeatureReleaseRow {
  id: number;
  name: string;
  description: string;
  release_date: string;
  status: 'released' | 'planned';
  created_at: string;
}

export interface ReleaseCohortImpactRow {
  id: number;
  release_id: number;
  cohort_id: string;
  cohort_type: 'ml' | 'rule';
  impact_score: number;
  direction: 'positive' | 'negative' | 'neutral';
  created_at: string;
}

export function getAllReleases(): FeatureReleaseRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM feature_releases ORDER BY release_date DESC
  `).all() as FeatureReleaseRow[];
}

export function getReleaseById(id: number): FeatureReleaseRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM feature_releases WHERE id = ?').get(id) as FeatureReleaseRow | undefined;
  return row ?? null;
}

export function createRelease(
  name: string,
  description: string,
  releaseDate: string,
  status: 'released' | 'planned',
): FeatureReleaseRow {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO feature_releases (name, description, release_date, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, description, releaseDate, status, now);
  return getReleaseById(result.lastInsertRowid as number)!;
}

export function getImpactsForRelease(releaseId: number): ReleaseCohortImpactRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM release_cohort_impacts WHERE release_id = ? ORDER BY impact_score DESC
  `).all(releaseId) as ReleaseCohortImpactRow[];
}

export function upsertCohortImpact(
  releaseId: number,
  cohortId: string,
  cohortType: 'ml' | 'rule',
  impactScore: number,
  direction: 'positive' | 'negative' | 'neutral',
): void {
  const db = getDb();
  const now = new Date().toISOString();
  // Delete existing and re-insert
  db.prepare('DELETE FROM release_cohort_impacts WHERE release_id = ? AND cohort_id = ?').run(releaseId, cohortId);
  db.prepare(`
    INSERT INTO release_cohort_impacts (release_id, cohort_id, cohort_type, impact_score, direction, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(releaseId, cohortId, cohortType, impactScore, direction, now);
}

export function getReleasedCount(): number {
  const db = getDb();
  return (db.prepare("SELECT COUNT(*) as cnt FROM feature_releases WHERE status = 'released'").get() as { cnt: number }).cnt;
}
