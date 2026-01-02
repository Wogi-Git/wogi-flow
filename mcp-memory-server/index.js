#!/usr/bin/env node

/**
 * MCP Memory Server for Wogi Flow
 *
 * Provides memory tools for Claude and other agents:
 * - remember_fact: Store facts in local SQLite with embeddings
 * - recall_facts: Semantic search over stored facts
 * - forget_fact: Remove facts from memory
 * - propose_team_rule: Create team proposals (requires team subscription)
 * - get_pending_proposals: View pending proposals
 * - vote_proposal: Vote on proposals
 * - store_prd: Store PRD chunks with embeddings
 * - get_prd_context: Retrieve relevant PRD context
 *
 * Free tier: All local operations work
 * Paid tier: Team operations sync to api.wogi-flow.com
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// ============================================================
// Configuration
// ============================================================

const PROJECT_ROOT = process.env.WOGI_PROJECT_ROOT || process.cwd();
const MEMORY_DIR = path.join(PROJECT_ROOT, '.workflow', 'memory');
const DB_PATH = path.join(MEMORY_DIR, 'local.db');
const CONFIG_PATH = path.join(PROJECT_ROOT, '.workflow', 'config.json');

// Team API (paid tier)
const TEAM_API_URL = process.env.WOGI_TEAM_API || 'https://api.wogi-flow.com';

// ============================================================
// Database Setup
// ============================================================

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

let SQL = null;

async function initDatabase() {
  ensureDirectoryExists(MEMORY_DIR);

  // Initialize sql.js
  if (!SQL) {
    SQL = await initSqlJs();
  }

  // Load existing database or create new
  let db;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    -- Facts table for storing memories
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
    -- Proposals table for team rules
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      rule TEXT NOT NULL,
      category TEXT,
      rationale TEXT,
      source_context TEXT,
      status TEXT DEFAULT 'pending',
      votes TEXT DEFAULT '[]',
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      decided_at TEXT
    )
  `);

  db.run(`
    -- PRD chunks table
    CREATE TABLE IF NOT EXISTS prd_chunks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      section TEXT,
      content TEXT,
      chunk_type TEXT,
      embedding TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    -- Sync state for team features
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create indexes (ignore errors if they already exist)
  try { db.run('CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_facts_scope ON facts(scope)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_facts_model ON facts(model)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_prd_project ON prd_chunks(project_id)'); } catch {}

  // Save initial database
  saveDatabase(db);

  return db;
}

function saveDatabase(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ============================================================
// Embeddings
// ============================================================

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    const { pipeline } = await import('@xenova/transformers');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

async function getEmbedding(text) {
  const embed = await getEmbedder();
  const result = await embed(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

function embeddingToJson(embedding) {
  return JSON.stringify(embedding);
}

function jsonToEmbedding(json) {
  return JSON.parse(json);
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================
// Configuration
// ============================================================

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    // Ignore errors
  }
  return {};
}

function isTeamEnabled() {
  const config = getConfig();
  return config.team?.enabled && config.team?.teamId && config.team?.apiKey;
}

// ============================================================
// Tool Implementations
// ============================================================

async function rememberFact(db, { fact, category, scope, model, sourceContext }) {
  const id = `fact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const embedding = await getEmbedding(fact);

  db.run(`
    INSERT INTO facts (id, fact, category, scope, model, embedding, source_context)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, fact, category || 'general', scope || 'local', model || null, embeddingToJson(embedding), sourceContext || null]);
  saveDatabase(db);

  // If team scope, create a proposal
  if (scope === 'team') {
    if (!isTeamEnabled()) {
      return {
        id,
        stored: true,
        warning: 'Team features require a subscription. Fact stored locally only.'
      };
    }

    await proposeTeamRule(db, {
      rule: fact,
      category: category || 'pattern',
      rationale: 'Auto-proposed from correction',
      sourceContext
    });

    return { id, stored: true, proposalCreated: true };
  }

  return { id, stored: true };
}

async function recallFacts(db, { query, category, limit = 10, includeTeam = true }) {
  const queryEmbedding = await getEmbedding(query);

  // Build SQL query
  let sql = 'SELECT * FROM facts WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (!includeTeam) {
    sql += ' AND scope = ?';
    params.push('local');
  }

  const result = db.exec(sql, params);
  if (!result.length) return [];

  const columns = result[0].columns;
  const facts = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });

  // Calculate similarity and rank
  const ranked = facts.map(f => {
    const embedding = f.embedding ? jsonToEmbedding(f.embedding) : [];
    const similarity = embedding.length ? cosineSimilarity(queryEmbedding, embedding) : 0;
    return { ...f, similarity, embedding: undefined };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, limit);

  return ranked.map(({ id, fact, category, scope, model, similarity, created_at }) => ({
    id,
    fact,
    category,
    scope,
    model,
    relevance: Math.round(similarity * 100),
    createdAt: created_at
  }));
}

async function forgetFact(db, { factId }) {
  db.run('DELETE FROM facts WHERE id = ?', [factId]);
  const changes = db.getRowsModified();
  saveDatabase(db);
  return { deleted: changes > 0 };
}

async function proposeTeamRule(db, { rule, category, rationale, sourceContext }) {
  if (!isTeamEnabled()) {
    return {
      success: false,
      error: 'Team features require a subscription. Use scope: "local" for local-only storage.'
    };
  }

  const id = `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  db.run(`
    INSERT INTO proposals (id, rule, category, rationale, source_context)
    VALUES (?, ?, ?, ?, ?)
  `, [id, rule, category || 'pattern', rationale || '', sourceContext || null]);
  saveDatabase(db);

  return {
    id,
    status: 'pending',
    message: 'Proposal created. Will sync to team on next sync.'
  };
}

async function getPendingProposals(db, {}) {
  const result = db.exec(`SELECT * FROM proposals WHERE status = 'pending' ORDER BY created_at DESC`);
  if (!result.length) return [];

  const columns = result[0].columns;
  const proposals = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });

  return proposals.map(p => ({
    id: p.id,
    rule: p.rule,
    category: p.category,
    rationale: p.rationale,
    sourceContext: p.source_context,
    createdAt: p.created_at,
    votes: JSON.parse(p.votes || '[]')
  }));
}

async function voteProposal(db, { proposalId, vote, comment }) {
  if (!isTeamEnabled()) {
    return { success: false, error: 'Team features require a subscription.' };
  }

  const result = db.exec('SELECT * FROM proposals WHERE id = ?', [proposalId]);
  if (!result.length || !result[0].values.length) {
    return { success: false, error: 'Proposal not found' };
  }

  const columns = result[0].columns;
  const row = result[0].values[0];
  const proposal = {};
  columns.forEach((col, i) => { proposal[col] = row[i]; });

  const votes = JSON.parse(proposal.votes || '[]');
  votes.push({
    vote,
    comment: comment || '',
    timestamp: new Date().toISOString()
  });

  db.run('UPDATE proposals SET votes = ? WHERE id = ?', [JSON.stringify(votes), proposalId]);
  saveDatabase(db);

  return { success: true, voteRecorded: true };
}

async function storePrd(db, { content, projectId, sections }) {
  const chunks = chunkPrd(content);
  const storedChunks = [];

  for (const chunk of chunks) {
    const id = `prd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const embedding = await getEmbedding(chunk.content);

    db.run(`
      INSERT INTO prd_chunks (id, project_id, section, content, chunk_type, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, projectId || 'default', chunk.section, chunk.content, chunk.type, embeddingToJson(embedding)]);

    storedChunks.push({ id, section: chunk.section, type: chunk.type });
  }

  saveDatabase(db);

  return {
    stored: true,
    chunks: storedChunks.length,
    sections: [...new Set(storedChunks.map(c => c.section))]
  };
}

function chunkPrd(content) {
  const chunks = [];
  const sections = content.split(/^##\s+/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n');
    const title = lines[0]?.trim() || 'Untitled';
    const sectionContent = lines.slice(1).join('\n');

    const paragraphs = sectionContent.split(/\n\n+/);

    for (const para of paragraphs) {
      if (para.length < 50) continue;

      if (para.length > 500) {
        // Split long paragraphs
        const words = para.split(/\s+/);
        let currentChunk = '';
        for (const word of words) {
          if ((currentChunk + ' ' + word).length > 500) {
            if (currentChunk.length > 50) {
              chunks.push({
                section: title,
                content: currentChunk.trim(),
                type: detectChunkType(currentChunk)
              });
            }
            currentChunk = word;
          } else {
            currentChunk += ' ' + word;
          }
        }
        if (currentChunk.length > 50) {
          chunks.push({
            section: title,
            content: currentChunk.trim(),
            type: detectChunkType(currentChunk)
          });
        }
      } else {
        chunks.push({
          section: title,
          content: para.trim(),
          type: detectChunkType(para)
        });
      }
    }
  }

  return chunks;
}

function detectChunkType(content) {
  if (/^[-*]\s/m.test(content)) return 'list';
  if (/acceptance criteria|given.*when.*then/i.test(content)) return 'criteria';
  if (/constraint|must not|required|shall not/i.test(content)) return 'constraint';
  if (/goal|objective|purpose|aim/i.test(content)) return 'goal';
  return 'description';
}

async function getPrdContext(db, { taskDescription, maxTokens = 2000 }) {
  const taskEmbedding = await getEmbedding(taskDescription);

  const result = db.exec('SELECT * FROM prd_chunks');
  if (!result.length) {
    return { context: 'No PRD context available.', chunksIncluded: 0, topRelevance: 0 };
  }

  const columns = result[0].columns;
  const chunks = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });

  // Calculate similarity and rank
  const ranked = chunks.map(c => {
    const embedding = c.embedding ? jsonToEmbedding(c.embedding) : [];
    const similarity = embedding.length ? cosineSimilarity(taskEmbedding, embedding) : 0;
    return { ...c, similarity, embedding: undefined };
  }).sort((a, b) => b.similarity - a.similarity);

  // Prioritize by type
  const priorityOrder = ['constraint', 'criteria', 'goal', 'description', 'list'];
  ranked.sort((a, b) => {
    if (Math.abs(a.similarity - b.similarity) > 0.1) {
      return b.similarity - a.similarity;
    }
    return priorityOrder.indexOf(a.chunk_type) - priorityOrder.indexOf(b.chunk_type);
  });

  // Build context within token limit (rough: 4 chars = 1 token)
  let context = '## Relevant PRD Context\n\n';
  let tokenCount = 0;
  const maxChars = maxTokens * 4;

  for (const chunk of ranked) {
    const chunkText = `### ${chunk.section}\n${chunk.content}\n\n`;
    if (tokenCount + chunkText.length > maxChars) break;

    context += chunkText;
    tokenCount += chunkText.length;
  }

  return {
    context,
    chunksIncluded: Math.floor(tokenCount / (maxChars / ranked.length)) || 0,
    topRelevance: ranked[0]?.similarity ? Math.round(ranked[0].similarity * 100) : 0
  };
}

async function getMemoryStats(db, {}) {
  // Helper to get single value
  function getCount(sql, params = []) {
    const result = db.exec(sql, params);
    if (!result.length || !result[0].values.length) return 0;
    return result[0].values[0][0];
  }

  // Helper to get key-value pairs
  function getKeyValuePairs(sql) {
    const result = db.exec(sql);
    if (!result.length) return {};
    return Object.fromEntries(result[0].values.map(row => [row[0], row[1]]));
  }

  const factCount = getCount('SELECT COUNT(*) FROM facts');
  const proposalCount = getCount('SELECT COUNT(*) FROM proposals WHERE status = ?', ['pending']);
  const prdChunkCount = getCount('SELECT COUNT(*) FROM prd_chunks');

  const categories = getKeyValuePairs('SELECT category, COUNT(*) FROM facts GROUP BY category');
  const scopes = getKeyValuePairs('SELECT scope, COUNT(*) FROM facts GROUP BY scope');

  return {
    facts: {
      total: factCount,
      byCategory: categories,
      byScope: scopes
    },
    proposals: {
      pending: proposalCount
    },
    prd: {
      chunks: prdChunkCount
    },
    teamEnabled: isTeamEnabled()
  };
}

// ============================================================
// MCP Server Setup
// ============================================================

const TOOLS = [
  {
    name: 'remember_fact',
    description: 'Store a fact in memory. Use scope: "local" for project-only, "team" to propose to team (requires subscription).',
    inputSchema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'The fact to remember' },
        category: {
          type: 'string',
          enum: ['project', 'skill', 'decision', 'pattern', 'anti-pattern', 'model-specific', 'general'],
          description: 'Category of the fact'
        },
        scope: {
          type: 'string',
          enum: ['local', 'team'],
          description: 'local = this project only, team = propose to team (paid feature)'
        },
        model: {
          type: 'string',
          description: 'If model-specific, which model this applies to (e.g., claude-opus-4, gemini-pro)'
        },
        sourceContext: {
          type: 'string',
          description: 'Context about where this fact came from (e.g., task ID, file path)'
        }
      },
      required: ['fact']
    }
  },
  {
    name: 'recall_facts',
    description: 'Retrieve facts from memory using semantic search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', description: 'Optional category filter' },
        limit: { type: 'number', description: 'Maximum results (default: 10)' },
        includeTeam: { type: 'boolean', description: 'Include team facts (default: true)' }
      },
      required: ['query']
    }
  },
  {
    name: 'forget_fact',
    description: 'Remove a fact from memory',
    inputSchema: {
      type: 'object',
      properties: {
        factId: { type: 'string', description: 'ID of the fact to remove' }
      },
      required: ['factId']
    }
  },
  {
    name: 'propose_team_rule',
    description: 'Propose a new rule for team approval (requires subscription)',
    inputSchema: {
      type: 'object',
      properties: {
        rule: { type: 'string', description: 'The rule to propose' },
        category: { type: 'string', description: 'Category (pattern, anti-pattern, convention)' },
        rationale: { type: 'string', description: 'Why this rule should be adopted' },
        sourceContext: { type: 'string', description: 'What triggered this proposal' }
      },
      required: ['rule']
    }
  },
  {
    name: 'get_pending_proposals',
    description: 'Get proposals awaiting approval',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'vote_proposal',
    description: 'Vote on a proposal (requires subscription)',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'ID of the proposal' },
        vote: { type: 'string', enum: ['approve', 'reject'], description: 'Your vote' },
        comment: { type: 'string', description: 'Optional comment' }
      },
      required: ['proposalId', 'vote']
    }
  },
  {
    name: 'store_prd',
    description: 'Store project PRD/documentation for context retrieval',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The PRD content (markdown)' },
        projectId: { type: 'string', description: 'Project identifier' },
        sections: { type: 'array', items: { type: 'string' }, description: 'Section names to focus on' }
      },
      required: ['content']
    }
  },
  {
    name: 'get_prd_context',
    description: 'Retrieve relevant PRD context for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskDescription: { type: 'string', description: 'Description of the current task' },
        maxTokens: { type: 'number', description: 'Maximum tokens of context (default: 2000)' }
      },
      required: ['taskDescription']
    }
  },
  {
    name: 'get_memory_stats',
    description: 'Get statistics about stored memories',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

const TOOL_HANDLERS = {
  remember_fact: rememberFact,
  recall_facts: recallFacts,
  forget_fact: forgetFact,
  propose_team_rule: proposeTeamRule,
  get_pending_proposals: getPendingProposals,
  vote_proposal: voteProposal,
  store_prd: storePrd,
  get_prd_context: getPrdContext,
  get_memory_stats: getMemoryStats
};

async function main() {
  const db = await initDatabase();

  const server = new Server(
    {
      name: 'wogi-memory-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }]
      };
    }

    try {
      const result = await handler(db, args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
        isError: true
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Wogi Memory Server started');
}

main().catch(console.error);
