#!/usr/bin/env node

/**
 * Wogi Flow - PRD Manager
 *
 * Manages Project Requirements Documents (PRDs) with:
 * - Loading and chunking PRD content
 * - Semantic storage for contextual retrieval
 * - Task-aware context extraction
 *
 * Part of v1.8.0 Team Collaboration
 *
 * Usage:
 *   ./scripts/flow prd load <file>     Load PRD into memory
 *   ./scripts/flow prd context <task>  Get relevant PRD context for task
 *   ./scripts/flow prd list            List loaded PRDs
 *   ./scripts/flow prd clear           Clear PRD memory
 */

const fs = require('fs');
const path = require('path');
const {
  getConfig,
  STATE_DIR,
  colors,
  color,
  success,
  warn,
  error,
  info,
  printHeader,
  fileExists,
  readFile,
  writeFile
} = require('./flow-utils');

// ============================================================
// Constants
// ============================================================

const PRD_STORAGE_FILE = path.join(STATE_DIR, 'prd-chunks.json');
const DEFAULT_CHUNK_SIZE = 500; // characters
const DEFAULT_MAX_CONTEXT_TOKENS = 2000;

// ============================================================
// PRD Chunking
// ============================================================

/**
 * Chunk PRD content into semantic blocks
 *
 * @param {string} content - The PRD markdown content
 * @param {object} options - Chunking options
 * @returns {Array} Array of chunk objects
 */
function chunkPRD(content, options = {}) {
  const { chunkSize = DEFAULT_CHUNK_SIZE } = options;
  const chunks = [];

  // Split by headers (## or ###)
  const sections = content.split(/(?=^##\s+)/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    // Extract section title
    const titleMatch = section.match(/^(#{2,3})\s+(.+)/m);
    const sectionTitle = titleMatch ? titleMatch[2].trim() : 'Introduction';
    const headerLevel = titleMatch ? titleMatch[1].length : 2;

    // Remove the header from content
    const sectionContent = titleMatch
      ? section.slice(titleMatch[0].length).trim()
      : section.trim();

    // Split by paragraphs
    const paragraphs = sectionContent.split(/\n\n+/);

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed || trimmed.length < 20) continue;

      // Detect chunk type
      const type = detectChunkType(trimmed);

      if (trimmed.length > chunkSize) {
        // Split long paragraphs by sentences
        const subChunks = splitBySize(trimmed, chunkSize);
        for (const sub of subChunks) {
          chunks.push({
            id: `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            section: sectionTitle,
            content: sub,
            type,
            headerLevel
          });
        }
      } else {
        chunks.push({
          id: `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          section: sectionTitle,
          content: trimmed,
          type,
          headerLevel
        });
      }
    }
  }

  return chunks;
}

/**
 * Detect the type of a chunk for prioritization
 */
function detectChunkType(content) {
  const lower = content.toLowerCase();

  // Check for acceptance criteria patterns
  if (/acceptance criteria|given.*when.*then|scenario:/i.test(content)) {
    return 'criteria';
  }

  // Check for constraints/requirements
  if (/must not|must be|required|constraint|shall not|shall be/i.test(lower)) {
    return 'constraint';
  }

  // Check for goals/objectives
  if (/goal|objective|purpose|aim|target/i.test(lower)) {
    return 'goal';
  }

  // Check for list items
  if (/^[-*•]\s/m.test(content)) {
    return 'list';
  }

  // Check for technical specifications
  if (/api|endpoint|database|schema|interface|component/i.test(lower)) {
    return 'technical';
  }

  return 'description';
}

/**
 * Split text into chunks of approximately target size
 */
function splitBySize(text, targetSize) {
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > targetSize && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

// ============================================================
// Storage
// ============================================================

/**
 * Load stored PRD chunks
 */
function loadStoredChunks() {
  if (!fileExists(PRD_STORAGE_FILE)) {
    return { prds: {}, chunks: [] };
  }

  try {
    return JSON.parse(readFile(PRD_STORAGE_FILE));
  } catch (e) {
    return { prds: {}, chunks: [] };
  }
}

/**
 * Save PRD chunks to storage
 */
function saveChunks(data) {
  writeFile(PRD_STORAGE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Load a PRD file into storage
 */
function loadPRD(filePath, options = {}) {
  const config = getConfig();
  const chunkSize = config.prd?.chunkSize || DEFAULT_CHUNK_SIZE;

  if (!fileExists(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFile(filePath);
  const fileName = path.basename(filePath);
  const prdId = options.id || fileName.replace(/\.[^.]+$/, '');

  // Chunk the content
  const chunks = chunkPRD(content, { chunkSize });

  // Add PRD metadata to chunks
  const taggedChunks = chunks.map(chunk => ({
    ...chunk,
    prdId,
    fileName,
    loadedAt: new Date().toISOString()
  }));

  // Load existing data
  const data = loadStoredChunks();

  // Remove old chunks from this PRD
  data.chunks = data.chunks.filter(c => c.prdId !== prdId);

  // Add new chunks
  data.chunks.push(...taggedChunks);

  // Update PRD metadata
  data.prds[prdId] = {
    fileName,
    filePath: path.resolve(filePath),
    loadedAt: new Date().toISOString(),
    chunkCount: taggedChunks.length
  };

  saveChunks(data);

  return {
    prdId,
    chunkCount: taggedChunks.length,
    sections: [...new Set(taggedChunks.map(c => c.section))]
  };
}

// ============================================================
// Context Retrieval
// ============================================================

/**
 * Calculate simple similarity between query and text
 * (In production, this would use embeddings)
 */
function calculateSimilarity(query, text) {
  const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const textWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);

  if (queryWords.length === 0) return 0;

  const matches = queryWords.filter(qw =>
    textWords.some(tw => tw.includes(qw) || qw.includes(tw))
  );

  return matches.length / queryWords.length;
}

/**
 * Get relevant PRD context for a task
 *
 * @param {string} taskDescription - The task description or query
 * @param {object} options - Retrieval options
 * @returns {string} Formatted context for the task
 */
function getPRDContext(taskDescription, options = {}) {
  const config = getConfig();
  const maxTokens = options.maxTokens || config.prd?.maxContextTokens || DEFAULT_MAX_CONTEXT_TOKENS;

  const data = loadStoredChunks();

  if (data.chunks.length === 0) {
    return null;
  }

  // Calculate similarity for each chunk
  const scored = data.chunks.map(chunk => ({
    ...chunk,
    similarity: calculateSimilarity(taskDescription, chunk.content + ' ' + chunk.section)
  }));

  // Sort by similarity, then by type priority
  const typePriority = {
    constraint: 0,
    criteria: 1,
    goal: 2,
    technical: 3,
    description: 4,
    list: 5
  };

  scored.sort((a, b) => {
    // First by similarity
    if (Math.abs(a.similarity - b.similarity) > 0.1) {
      return b.similarity - a.similarity;
    }
    // Then by type priority
    return (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
  });

  // Build context within token limit (rough: 4 chars = 1 token)
  let context = '## Relevant PRD Context\n\n';
  let charCount = context.length;
  const maxChars = maxTokens * 4;
  const includedSections = new Set();

  for (const chunk of scored) {
    if (chunk.similarity < 0.1 && includedSections.size >= 3) {
      // Skip low-relevance chunks after we have some context
      continue;
    }

    const chunkText = `### ${chunk.section}\n${chunk.content}\n\n`;

    if (charCount + chunkText.length > maxChars) {
      break;
    }

    // Avoid duplicate section headers
    if (!includedSections.has(chunk.section)) {
      context += `### ${chunk.section}\n`;
      includedSections.add(chunk.section);
    }
    context += `${chunk.content}\n\n`;
    charCount += chunkText.length;
  }

  return context.trim();
}

/**
 * List loaded PRDs
 */
function listPRDs() {
  const data = loadStoredChunks();

  if (Object.keys(data.prds).length === 0) {
    return [];
  }

  return Object.entries(data.prds).map(([id, prd]) => ({
    id,
    ...prd
  }));
}

/**
 * Clear all PRD data
 */
function clearPRDs() {
  saveChunks({ prds: {}, chunks: [] });
}

/**
 * Remove a specific PRD
 */
function removePRD(prdId) {
  const data = loadStoredChunks();

  if (!data.prds[prdId]) {
    return false;
  }

  delete data.prds[prdId];
  data.chunks = data.chunks.filter(c => c.prdId !== prdId);

  saveChunks(data);
  return true;
}

// ============================================================
// CLI
// ============================================================

function printUsage() {
  console.log(`
Wogi Flow - PRD Manager

Usage: ./scripts/flow prd <command> [args]

Commands:
  load <file>           Load PRD markdown file into memory
  context <task>        Get relevant PRD context for task
  list                  List loaded PRDs
  show <prd-id>         Show chunks from a specific PRD
  remove <prd-id>       Remove a PRD from memory
  clear                 Clear all PRD data

Examples:
  ./scripts/flow prd load docs/PRD.md
  ./scripts/flow prd context "implement user login"
  ./scripts/flow prd list

Configuration (config.json):
  prd.enabled            Enable PRD features (default: false)
  prd.maxContextTokens   Max tokens for context (default: 2000)
  prd.chunkSize          Chunk size in chars (default: 500)
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'load': {
      printHeader('Load PRD');

      const filePath = args[1];
      if (!filePath) {
        error('Please provide a file path');
        process.exit(1);
      }

      try {
        const result = loadPRD(filePath);
        success(`Loaded PRD: ${result.prdId}`);
        console.log(`  Chunks: ${result.chunkCount}`);
        console.log(`  Sections: ${result.sections.join(', ')}`);
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
      break;
    }

    case 'context': {
      const task = args.slice(1).join(' ');
      if (!task) {
        error('Please provide a task description');
        process.exit(1);
      }

      const context = getPRDContext(task);
      if (!context) {
        warn('No PRD loaded. Run: ./scripts/flow prd load <file>');
        process.exit(0);
      }

      console.log(context);
      break;
    }

    case 'list': {
      printHeader('Loaded PRDs');

      const prds = listPRDs();
      if (prds.length === 0) {
        info('No PRDs loaded.');
        info('Load one with: ./scripts/flow prd load <file>');
        break;
      }

      console.log('');
      for (const prd of prds) {
        console.log(`  ${color('green', prd.id)}`);
        console.log(`    File: ${prd.fileName}`);
        console.log(`    Chunks: ${prd.chunkCount}`);
        console.log(`    Loaded: ${prd.loadedAt}`);
        console.log('');
      }
      break;
    }

    case 'show': {
      const prdId = args[1];
      if (!prdId) {
        error('Please provide a PRD ID');
        process.exit(1);
      }

      const data = loadStoredChunks();
      const chunks = data.chunks.filter(c => c.prdId === prdId);

      if (chunks.length === 0) {
        error(`PRD not found: ${prdId}`);
        process.exit(1);
      }

      printHeader(`PRD: ${prdId}`);
      console.log('');

      // Group by section
      const bySection = {};
      for (const chunk of chunks) {
        if (!bySection[chunk.section]) {
          bySection[chunk.section] = [];
        }
        bySection[chunk.section].push(chunk);
      }

      for (const [section, sectionChunks] of Object.entries(bySection)) {
        console.log(color('green', `## ${section}`));
        for (const chunk of sectionChunks) {
          console.log(color('dim', `[${chunk.type}]`));
          console.log(chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : ''));
          console.log('');
        }
      }
      break;
    }

    case 'remove': {
      const prdId = args[1];
      if (!prdId) {
        error('Please provide a PRD ID');
        process.exit(1);
      }

      if (removePRD(prdId)) {
        success(`Removed PRD: ${prdId}`);
      } else {
        error(`PRD not found: ${prdId}`);
        process.exit(1);
      }
      break;
    }

    case 'clear': {
      clearPRDs();
      success('All PRD data cleared');
      break;
    }

    case '--help':
    case '-h':
    case 'help':
      printUsage();
      break;

    default:
      if (command) {
        error(`Unknown command: ${command}`);
      }
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  chunkPRD,
  detectChunkType,
  loadPRD,
  getPRDContext,
  listPRDs,
  clearPRDs,
  removePRD,
  loadStoredChunks
};

if (require.main === module) {
  main();
}
