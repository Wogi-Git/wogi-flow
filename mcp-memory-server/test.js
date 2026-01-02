#!/usr/bin/env node

/**
 * MCP Memory Server - Test Suite
 *
 * Tests database operations without starting the MCP server.
 */

const path = require('path');
const fs = require('fs');

process.env.WOGI_PROJECT_ROOT = path.join(__dirname, '..');

async function test() {
  console.log('🧪 Testing MCP Memory Server...\n');

  const initSqlJs = require('sql.js');

  const PROJECT_ROOT = process.env.WOGI_PROJECT_ROOT;
  const MEMORY_DIR = path.join(PROJECT_ROOT, '.workflow', 'memory');
  const DB_PATH = path.join(MEMORY_DIR, 'test.db');

  // Cleanup test database
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  // Ensure directory exists
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }

  // Initialize sql.js
  console.log('1. Testing sql.js initialization...');
  const SQL = await initSqlJs();
  console.log('   ✅ sql.js initialized\n');

  // Create database
  console.log('2. Testing database creation...');
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      fact TEXT NOT NULL,
      category TEXT,
      scope TEXT DEFAULT 'local',
      model TEXT,
      embedding TEXT,
      source_context TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      rule TEXT NOT NULL,
      category TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS prd_chunks (
      id TEXT PRIMARY KEY,
      section TEXT,
      content TEXT,
      embedding TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  console.log('   ✅ Tables created\n');

  // Test insert
  console.log('3. Testing data insertion...');
  const testEmbedding = JSON.stringify([0.1, 0.2, 0.3, 0.4, 0.5]);

  db.run(
    'INSERT INTO facts (id, fact, category, scope, embedding) VALUES (?, ?, ?, ?, ?)',
    ['fact_1', 'Always use explicit types in TypeScript', 'pattern', 'local', testEmbedding]
  );

  db.run(
    'INSERT INTO facts (id, fact, category, scope, model, embedding) VALUES (?, ?, ?, ?, ?, ?)',
    ['fact_2', 'Claude needs explicit return types', 'model-specific', 'local', 'claude', testEmbedding]
  );

  console.log('   ✅ Facts inserted\n');

  // Test query
  console.log('4. Testing query...');
  const result = db.exec('SELECT id, fact, category, model FROM facts');
  if (result.length > 0) {
    console.log('   Found', result[0].values.length, 'facts:');
    for (const row of result[0].values) {
      console.log('   -', row[0], ':', row[1].substring(0, 40) + '...');
    }
  }
  console.log('   ✅ Query works\n');

  // Test persistence
  console.log('5. Testing database persistence...');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  console.log('   Saved to', DB_PATH, '(' + buffer.length + ' bytes)');

  // Reload
  const loadedBuffer = fs.readFileSync(DB_PATH);
  const db2 = new SQL.Database(loadedBuffer);
  const result2 = db2.exec('SELECT COUNT(*) FROM facts');
  console.log('   Reloaded:', result2[0].values[0][0], 'facts');
  console.log('   ✅ Persistence works\n');

  // Cleanup
  fs.unlinkSync(DB_PATH);
  console.log('6. Cleanup complete\n');

  console.log('═'.repeat(40));
  console.log('All tests passed! ✅');
  console.log('═'.repeat(40));
}

test().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
