#!/usr/bin/env node

/**
 * Wogi Flow - Memory Database Module
 *
 * Shared database operations for memory storage.
 * Used by both MCP server and CLI tools.
 *
 * Features:
 * - SQLite database with sql.js
 * - Embeddings via @xenova/transformers
 * - Facts, proposals, and PRD storage
 * - Semantic similarity search
 *
 * Part of v1.8.0 - Consolidated memory storage
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// Configuration
// ============================================================

const PROJECT_ROOT = process.env.WOGI_PROJECT_ROOT || process.cwd();
const WORKFLOW_DIR = path.join(PROJECT_ROOT, '.workflow');
const MEMORY_DIR = path.join(WORKFLOW_DIR, 'memory');
const DB_PATH = path.join(MEMORY_DIR, 'local.db');

// ============================================================
// Database Singleton
// ============================================================

let SQL = null;
let db = null;
let embedder = null;
let initPromise = null;

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Initialize database (singleton)
 */
async function initDatabase() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    ensureDir(MEMORY_DIR);

    // Initialize sql.js
    if (!SQL) {
      const initSqlJs = require('sql.js');
      SQL = await initSqlJs();
    }

    // Load existing database or create new
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        fact TEXT NOT NULL,
        category TEXT,
        scope TEXT DEFAULT 'local',
        model TEXT,
        embedding TEXT,
        source_context TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        rule TEXT NOT NULL,
        category TEXT,
        rationale TEXT,
        source_context TEXT,
        status TEXT DEFAULT 'pending',
        votes TEXT DEFAULT '[]',
        synced INTEGER DEFAULT 0,
        remote_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        decided_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS prd_chunks (
        id TEXT PRIMARY KEY,
        prd_id TEXT,
        section TEXT,
        content TEXT,
        chunk_type TEXT,
        embedding TEXT,
        file_name TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create indexes
    try { db.run('CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category)'); } catch {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_facts_scope ON facts(scope)'); } catch {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_facts_model ON facts(model)'); } catch {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status)'); } catch {}
    try { db.run('CREATE INDEX IF NOT EXISTS idx_prd_prd_id ON prd_chunks(prd_id)'); } catch {}

    saveDatabase();
    return db;
  })();

  return initPromise;
}

/**
 * Save database to disk
 */
function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * Close database
 */
function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    initPromise = null;
  }
}

// ============================================================
// Embeddings
// ============================================================

/**
 * Get embedder (lazy load)
 */
async function getEmbedder() {
  if (!embedder) {
    const { pipeline } = await import('@xenova/transformers');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

/**
 * Get embedding for text
 */
async function getEmbedding(text) {
  const embed = await getEmbedder();
  const result = await embed(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

/**
 * Calculate cosine similarity
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================
// Utility Functions
// ============================================================

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function embeddingToJson(embedding) {
  return JSON.stringify(embedding);
}

function jsonToEmbedding(json) {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function queryToRows(result) {
  if (!result.length) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// ============================================================
// Facts Operations
// ============================================================

/**
 * Store a fact
 */
async function storeFact({ fact, category, scope, model, sourceContext }) {
  await initDatabase();
  const id = generateId('fact');
  const embedding = await getEmbedding(fact);

  db.run(`
    INSERT INTO facts (id, fact, category, scope, model, embedding, source_context)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, fact, category || 'general', scope || 'local', model || null, embeddingToJson(embedding), sourceContext || null]);
  saveDatabase();

  return { id, stored: true };
}

/**
 * Search facts by similarity
 */
async function searchFacts({ query, category, model, scope, limit = 10 }) {
  await initDatabase();
  const queryEmbedding = await getEmbedding(query);

  let sql = 'SELECT * FROM facts WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (model) {
    sql += ' AND model = ?';
    params.push(model);
  }
  if (scope) {
    sql += ' AND scope = ?';
    params.push(scope);
  }

  const result = db.exec(sql, params);
  const facts = queryToRows(result);

  // Calculate similarity and rank
  const ranked = facts.map(f => {
    const embedding = f.embedding ? jsonToEmbedding(f.embedding) : [];
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    return { ...f, similarity, embedding: undefined };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, limit);

  return ranked.map(({ id, fact, category, scope, model, similarity, created_at }) => ({
    id, fact, category, scope, model,
    relevance: Math.round(similarity * 100),
    createdAt: created_at
  }));
}

/**
 * Delete a fact
 */
async function deleteFact(factId) {
  await initDatabase();
  db.run('DELETE FROM facts WHERE id = ?', [factId]);
  const changes = db.getRowsModified();
  saveDatabase();
  return { deleted: changes > 0 };
}

/**
 * Get all facts (for export/sync)
 */
async function getAllFacts({ scope } = {}) {
  await initDatabase();
  let sql = 'SELECT id, fact, category, scope, model, source_context, created_at FROM facts';
  const params = [];
  if (scope) {
    sql += ' WHERE scope = ?';
    params.push(scope);
  }
  const result = db.exec(sql, params);
  return queryToRows(result);
}

// ============================================================
// Proposals Operations
// ============================================================

/**
 * Create a proposal
 */
async function createProposal({ rule, category, rationale, sourceContext }) {
  await initDatabase();
  const id = generateId('proposal');

  db.run(`
    INSERT INTO proposals (id, rule, category, rationale, source_context)
    VALUES (?, ?, ?, ?, ?)
  `, [id, rule, category || 'pattern', rationale || '', sourceContext || null]);
  saveDatabase();

  return { id, status: 'pending' };
}

/**
 * Get proposals by status
 */
async function getProposals(status = 'pending') {
  await initDatabase();
  const result = db.exec(
    `SELECT * FROM proposals WHERE status = ? ORDER BY created_at DESC`,
    [status]
  );
  const proposals = queryToRows(result);

  return proposals.map(p => ({
    id: p.id,
    rule: p.rule,
    category: p.category,
    rationale: p.rationale,
    sourceContext: p.source_context,
    status: p.status,
    votes: JSON.parse(p.votes || '[]'),
    synced: !!p.synced,
    remoteId: p.remote_id,
    createdAt: p.created_at
  }));
}

/**
 * Update proposal (for sync)
 */
async function updateProposal(id, updates) {
  await initDatabase();
  const sets = [];
  const params = [];

  if (updates.status !== undefined) {
    sets.push('status = ?');
    params.push(updates.status);
  }
  if (updates.synced !== undefined) {
    sets.push('synced = ?');
    params.push(updates.synced ? 1 : 0);
  }
  if (updates.remoteId !== undefined) {
    sets.push('remote_id = ?');
    params.push(updates.remoteId);
  }
  if (updates.votes !== undefined) {
    sets.push('votes = ?');
    params.push(JSON.stringify(updates.votes));
  }

  if (sets.length === 0) return { updated: false };

  params.push(id);
  db.run(`UPDATE proposals SET ${sets.join(', ')} WHERE id = ?`, params);
  saveDatabase();

  return { updated: db.getRowsModified() > 0 };
}

/**
 * Get unsynced proposals
 */
async function getUnsyncedProposals() {
  await initDatabase();
  const result = db.exec('SELECT * FROM proposals WHERE synced = 0 AND status = ?', ['pending']);
  return queryToRows(result);
}

// ============================================================
// PRD Operations
// ============================================================

/**
 * Detect chunk type
 */
function detectChunkType(content) {
  if (/^[-*]\s/m.test(content)) return 'list';
  if (/acceptance criteria|given.*when.*then/i.test(content)) return 'criteria';
  if (/constraint|must not|required|shall not|shall be/i.test(content)) return 'constraint';
  if (/goal|objective|purpose|aim|target/i.test(content)) return 'goal';
  if (/api|endpoint|database|schema|interface|component/i.test(content)) return 'technical';
  return 'description';
}

/**
 * Chunk PRD content
 */
function chunkPRD(content, options = {}) {
  const { chunkSize = 500 } = options;
  const chunks = [];
  const sections = content.split(/(?=^##\s+)/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const titleMatch = section.match(/^(#{2,3})\s+(.+)/m);
    const sectionTitle = titleMatch ? titleMatch[2].trim() : 'Introduction';
    const sectionContent = titleMatch
      ? section.slice(titleMatch[0].length).trim()
      : section.trim();

    const paragraphs = sectionContent.split(/\n\n+/);

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed || trimmed.length < 30) continue;

      const type = detectChunkType(trimmed);

      if (trimmed.length > chunkSize) {
        // Split by sentences
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        let current = '';

        for (const sentence of sentences) {
          if (current.length + sentence.length > chunkSize && current.length > 30) {
            chunks.push({ section: sectionTitle, content: current.trim(), type });
            current = sentence;
          } else {
            current += (current ? ' ' : '') + sentence;
          }
        }
        if (current.length > 30) {
          chunks.push({ section: sectionTitle, content: current.trim(), type });
        }
      } else {
        chunks.push({ section: sectionTitle, content: trimmed, type });
      }
    }
  }

  return chunks;
}

/**
 * Store PRD chunks
 */
async function storePRD({ content, prdId, fileName }) {
  await initDatabase();
  const chunks = chunkPRD(content);
  const storedChunks = [];

  // Remove old chunks for this PRD
  db.run('DELETE FROM prd_chunks WHERE prd_id = ?', [prdId]);

  for (const chunk of chunks) {
    const id = generateId('prd');
    const embedding = await getEmbedding(chunk.content);

    db.run(`
      INSERT INTO prd_chunks (id, prd_id, section, content, chunk_type, embedding, file_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, prdId, chunk.section, chunk.content, chunk.type, embeddingToJson(embedding), fileName || null]);

    storedChunks.push({ id, section: chunk.section, type: chunk.type });
  }

  saveDatabase();

  return {
    prdId,
    chunkCount: storedChunks.length,
    sections: [...new Set(storedChunks.map(c => c.section))]
  };
}

/**
 * Get PRD context for a task
 */
async function getPRDContext({ query, maxTokens = 2000, prdId }) {
  await initDatabase();
  const queryEmbedding = await getEmbedding(query);

  let sql = 'SELECT * FROM prd_chunks';
  const params = [];
  if (prdId) {
    sql += ' WHERE prd_id = ?';
    params.push(prdId);
  }

  const result = db.exec(sql, params);
  const chunks = queryToRows(result);

  if (chunks.length === 0) return null;

  // Calculate similarity and rank
  const ranked = chunks.map(c => {
    const embedding = c.embedding ? jsonToEmbedding(c.embedding) : [];
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    return { ...c, similarity };
  });

  // Sort by similarity, then by type priority
  const typePriority = { constraint: 0, criteria: 1, goal: 2, technical: 3, description: 4, list: 5 };
  ranked.sort((a, b) => {
    if (Math.abs(a.similarity - b.similarity) > 0.1) return b.similarity - a.similarity;
    return (typePriority[a.chunk_type] || 99) - (typePriority[b.chunk_type] || 99);
  });

  // Build context within token limit
  let context = '## Relevant PRD Context\n\n';
  let charCount = context.length;
  const maxChars = maxTokens * 4;
  const includedSections = new Set();

  for (const chunk of ranked) {
    if (chunk.similarity < 0.1 && includedSections.size >= 3) continue;

    const prefix = !includedSections.has(chunk.section) ? `### ${chunk.section}\n` : '';
    const text = prefix + chunk.content + '\n\n';

    if (charCount + text.length > maxChars) break;

    if (prefix) includedSections.add(chunk.section);
    context += text;
    charCount += text.length;
  }

  return {
    context: context.trim(),
    topRelevance: ranked[0] ? Math.round(ranked[0].similarity * 100) : 0
  };
}

/**
 * List stored PRDs
 */
async function listPRDs() {
  await initDatabase();
  const result = db.exec(`
    SELECT prd_id, file_name, COUNT(*) as chunk_count, MIN(created_at) as created_at
    FROM prd_chunks
    GROUP BY prd_id
  `);
  return queryToRows(result);
}

/**
 * Delete a PRD
 */
async function deletePRD(prdId) {
  await initDatabase();
  db.run('DELETE FROM prd_chunks WHERE prd_id = ?', [prdId]);
  const changes = db.getRowsModified();
  saveDatabase();
  return { deleted: changes > 0 };
}

/**
 * Clear all PRDs
 */
async function clearPRDs() {
  await initDatabase();
  db.run('DELETE FROM prd_chunks');
  saveDatabase();
  return { cleared: true };
}

// ============================================================
// Sync State
// ============================================================

async function getSyncState(key) {
  await initDatabase();
  const result = db.exec('SELECT value FROM sync_state WHERE key = ?', [key]);
  const rows = queryToRows(result);
  return rows[0]?.value || null;
}

async function setSyncState(key, value) {
  await initDatabase();
  db.run(`
    INSERT OR REPLACE INTO sync_state (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `, [key, value]);
  saveDatabase();
}

// ============================================================
// Statistics
// ============================================================

async function getStats() {
  await initDatabase();

  function count(sql, params = []) {
    const result = db.exec(sql, params);
    if (!result.length || !result[0].values.length) return 0;
    return result[0].values[0][0];
  }

  function grouped(sql) {
    const result = db.exec(sql);
    if (!result.length) return {};
    return Object.fromEntries(result[0].values.map(row => [row[0] || 'null', row[1]]));
  }

  return {
    facts: {
      total: count('SELECT COUNT(*) FROM facts'),
      byCategory: grouped('SELECT category, COUNT(*) FROM facts GROUP BY category'),
      byScope: grouped('SELECT scope, COUNT(*) FROM facts GROUP BY scope')
    },
    proposals: {
      pending: count('SELECT COUNT(*) FROM proposals WHERE status = ?', ['pending']),
      total: count('SELECT COUNT(*) FROM proposals')
    },
    prds: {
      total: count('SELECT COUNT(DISTINCT prd_id) FROM prd_chunks'),
      chunks: count('SELECT COUNT(*) FROM prd_chunks')
    }
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Database management
  initDatabase,
  saveDatabase,
  closeDatabase,

  // Embeddings
  getEmbedding,
  cosineSimilarity,

  // Facts
  storeFact,
  searchFacts,
  deleteFact,
  getAllFacts,

  // Proposals
  createProposal,
  getProposals,
  updateProposal,
  getUnsyncedProposals,

  // PRDs
  chunkPRD,
  storePRD,
  getPRDContext,
  listPRDs,
  deletePRD,
  clearPRDs,

  // Sync
  getSyncState,
  setSyncState,

  // Stats
  getStats,

  // Paths
  DB_PATH,
  MEMORY_DIR
};
