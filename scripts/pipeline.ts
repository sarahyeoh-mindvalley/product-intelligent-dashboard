/**
 * Mindvalley Customer Cohorts — Daily Data Pipeline
 *
 * Simulates ingestion from four data sources:
 *   1. Purchase history
 *   2. Quest progress
 *   3. Engagement signals
 *   4. Subscription tiers
 *
 * Run with: pnpm pipeline
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'cohorts.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ensure schema
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
`);

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

const PRODUCT_NAMES = [
  'Superbrain', 'The M Word', 'Ultra Meditation', 'Be Extraordinary',
  'Mindvalley Life', 'Consciousness Engineering', 'Unlimited Abundance',
  'Lifebook Online', 'The Quest for Personal Mastery', 'Wildfit',
  '10X Fitness', 'Silva Ultramind', 'Energy Medicine', 'Rapid Transformational Therapy',
];

const PRODUCT_CATEGORIES = ['Mindfulness', 'Health & Fitness', 'Career & Finance', 'Relationships', 'Personal Growth'];

const QUEST_NAMES = [
  'Superbrain Quest', 'The M Word', 'Be Extraordinary Quest',
  'Consciousness Engineering Quest', 'Lifebook Quest', 'Wildfit Quest',
  '10X Fitness Quest', 'Personal Mastery Quest', 'Silva Mind Quest',
  'Ultra Meditation Quest', 'Energy Medicine Quest',
];

const QUEST_CATEGORIES = ['Mind', 'Body', 'Career', 'Relationships', 'Soul'];

const EVENT_TYPES = [
  'video_play', 'video_complete', 'lesson_complete', 'module_complete',
  'community_post', 'community_like', 'community_comment', 'live_session_join',
  'meditation_session', 'journal_entry', 'quest_start', 'app_open',
  'push_notification_open', 'email_open', 'webinar_attended',
];

const AI_EVENT_TYPES = [
  'ai_coaching',
  'ai_recommendation_click',
  'ai_quiz_complete',
  'ai_path_generated',
];

const EVENT_SOURCES = ['web', 'ios', 'android', 'email', 'push'];

const TIER_NAMES = [
  { name: 'Free', level: 0 },
  { name: 'Plus', level: 1 },
  { name: 'Tribe', level: 2 },
  { name: 'All Access', level: 3 },
  { name: 'All Access + Live', level: 4 },
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysBack));
  return d.toISOString();
}

function generateCustomerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `cust_${String(i + 1).padStart(5, '0')}`);
}

// Deterministic but varied seeding per run — includes time component so same-day re-runs produce different counts
const TODAY = new Date().toISOString().split('T')[0];
const DAILY_SEED = TODAY.split('-').reduce((a, b) => a + parseInt(b), 0) + (Date.now() % 10000);

function deterministicVariation(base: number, seed: number, variance: number): number {
  return base + Math.round(Math.sin(seed * 0.37) * variance);
}

// ---------------------------------------------------------------------------
// Ingestion functions
// ---------------------------------------------------------------------------

function ingestPurchaseHistory(runId: number, customerIds: string[]) {
  const insert = db.prepare(`
    INSERT INTO purchase_history (pipeline_run_id, customer_id, product_name, product_category, amount, currency, purchased_at)
    VALUES (?, ?, ?, ?, ?, 'USD', ?)
  `);

  const recordCount = deterministicVariation(1200, DAILY_SEED, 150);
  const ingestMany = db.transaction(() => {
    for (let i = 0; i < recordCount; i++) {
      const customerId = randomChoice(customerIds);
      const productName = randomChoice(PRODUCT_NAMES);
      const category = randomChoice(PRODUCT_CATEGORIES);
      const amount = randomFloat(47, 999);
      const purchasedAt = randomDate(90);

      insert.run(runId, customerId, productName, category, amount, purchasedAt);
    }
  });

  ingestMany();
  console.log(`  ✓ Purchase history: ${recordCount} records ingested`);
  return recordCount;
}

function ingestQuestProgress(runId: number, customerIds: string[]) {
  const insert = db.prepare(`
    INSERT INTO quest_progress (pipeline_run_id, customer_id, quest_name, quest_category, completion_percentage, last_activity_at, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const recordCount = deterministicVariation(3400, DAILY_SEED, 200);
  const ingestMany = db.transaction(() => {
    for (let i = 0; i < recordCount; i++) {
      const customerId = randomChoice(customerIds);
      const questName = randomChoice(QUEST_NAMES);
      const category = randomChoice(QUEST_CATEGORIES);
      // Bell curve: most people are somewhere in the middle
      const completionBase = randomFloat(0, 100);
      const completion = Math.min(100, Math.max(0, parseFloat((completionBase + randomFloat(-10, 10)).toFixed(1))));
      const lastActivity = randomDate(30);
      const startedAt = randomDate(180);

      insert.run(runId, customerId, questName, category, completion, lastActivity, startedAt);
    }
  });

  ingestMany();
  console.log(`  ✓ Quest progress: ${recordCount} records ingested`);
  return recordCount;
}

function ingestEngagementSignals(runId: number, customerIds: string[]) {
  const insert = db.prepare(`
    INSERT INTO engagement_signals (pipeline_run_id, customer_id, event_type, event_source, event_count, recorded_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const recordCount = deterministicVariation(8500, DAILY_SEED, 500);
  const ingestMany = db.transaction(() => {
    for (let i = 0; i < recordCount; i++) {
      const customerId = randomChoice(customerIds);
      const eventType = randomChoice(EVENT_TYPES);
      const eventSource = randomChoice(EVENT_SOURCES);
      const eventCount = randomInt(1, 12);
      const recordedDate = randomDate(7); // Last week's signals

      insert.run(runId, customerId, eventType, eventSource, eventCount, recordedDate);
    }
  });

  ingestMany();
  console.log(`  ✓ Engagement signals: ${recordCount} records ingested`);
  return recordCount;
}

function ingestAIEngagementSignals(runId: number, customerIds: string[]) {
  const insert = db.prepare(`
    INSERT INTO engagement_signals (pipeline_run_id, customer_id, event_type, event_source, event_count, recorded_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // ~20% of customers interact with AI features each run
  const aiCustomers = customerIds.filter((_, i) => i % 5 === 0);
  const sources = ['ios', 'android', 'web'];

  const ingestMany = db.transaction(() => {
    for (const customerId of aiCustomers) {
      const numEvents = randomInt(1, 4);
      for (let i = 0; i < numEvents; i++) {
        const eventType = randomChoice(AI_EVENT_TYPES);
        const source = randomChoice(sources);
        const recordedDate = randomDate(30);
        insert.run(runId, customerId, eventType, source, 1, recordedDate);
      }
    }
  });

  ingestMany();
  console.log(`  ✓ AI engagement signals: ${aiCustomers.length} AI-active users`);
  return aiCustomers.length;
}

function ingestSubscriptionTiers(runId: number, customerIds: string[]) {
  const insert = db.prepare(`
    INSERT INTO subscription_tiers (pipeline_run_id, customer_id, tier_name, tier_level, subscribed_since, renewal_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Each customer has one subscription record
  const sampleCustomers = customerIds.slice(0, deterministicVariation(2800, DAILY_SEED, 100));

  const ingestMany = db.transaction(() => {
    for (const customerId of sampleCustomers) {
      const tier = randomChoice(TIER_NAMES);
      const subscribedSince = randomDate(730); // Up to 2 years ago
      const renewalDays = randomInt(30, 365);
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + renewalDays);
      const isActive = Math.random() > 0.08 ? 1 : 0; // ~92% active

      insert.run(runId, customerId, tier.name, tier.level, subscribedSince, renewalDate.toISOString(), isActive);
    }
  });

  ingestMany();
  console.log(`  ✓ Subscription tiers: ${sampleCustomers.length} records ingested`);
  return sampleCustomers.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runPipeline() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const runDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD of the data being ingested (prior day)

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  Mission OS — Customer Journey Data Pipeline     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log(`Run date: ${runDate}`);
  console.log(`Started:  ${now.toISOString()}\n`);

  // Create a pipeline run record
  const runResult = db.prepare(`
    INSERT INTO pipeline_runs (run_date, completed_at, status)
    VALUES (?, ?, 'running')
  `).run(runDate, now.toISOString());

  const runId = runResult.lastInsertRowid as number;

  try {
    console.log('Ingesting data sources...\n');

    // Generate a shared customer pool
    const customerIds = generateCustomerIds(5000);

    ingestPurchaseHistory(runId, customerIds);
    ingestQuestProgress(runId, customerIds);
    ingestEngagementSignals(runId, customerIds);
    ingestAIEngagementSignals(runId, customerIds);
    ingestSubscriptionTiers(runId, customerIds);

    // Mark as success
    const completedAt = new Date().toISOString();
    db.prepare(`
      UPDATE pipeline_runs SET status = 'success', completed_at = ? WHERE id = ?
    `).run(completedAt, runId);

    console.log(`\n✓ Pipeline completed successfully at ${completedAt}`);
    console.log(`  Run ID: ${runId}`);
    console.log('  Data freshness: prior day data now available in dashboards\n');

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.prepare(`
      UPDATE pipeline_runs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?
    `).run(errorMsg, new Date().toISOString(), runId);

    console.error('\n✗ Pipeline failed:', errorMsg);
    process.exit(1);
  }
}

runPipeline();
