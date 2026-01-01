#!/usr/bin/env node

/**
 * Wogi Flow - Auto Context Loading
 *
 * Intelligently loads relevant context before any task starts.
 * Analyzes task descriptions and loads matching files from:
 * - app-map.md (component registry)
 * - component-index.json (auto-scanned files)
 * - Codebase grep results
 *
 * Inspired by Factory AI's proactive context gathering approach.
 *
 * Usage as module:
 *   const { getAutoContext } = require('./flow-auto-context');
 *   const context = getAutoContext('implement user authentication');
 *
 * Usage as CLI:
 *   flow auto-context "task description"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getProjectRoot, getConfig, PATHS, colors } = require('./flow-utils');

const PROJECT_ROOT = getProjectRoot();

// ============================================================
// Keyword Extraction
// ============================================================

/**
 * Extract keywords from task description
 * Returns weighted keywords for context matching
 */
function extractKeywords(description) {
  const text = description.toLowerCase();
  const words = text.match(/[a-z]+/g) || [];

  // High-value keywords (likely component/feature names)
  const highValue = new Set([
    'auth', 'authentication', 'login', 'logout', 'signup', 'register',
    'user', 'profile', 'account', 'settings', 'dashboard', 'admin',
    'form', 'modal', 'dialog', 'button', 'input', 'select', 'dropdown',
    'table', 'list', 'grid', 'card', 'nav', 'navigation', 'menu', 'sidebar',
    'header', 'footer', 'layout', 'page', 'view', 'screen',
    'api', 'service', 'hook', 'context', 'provider', 'store', 'state',
    'payment', 'checkout', 'cart', 'order', 'product', 'item',
    'search', 'filter', 'sort', 'pagination', 'infinite',
    'upload', 'download', 'file', 'image', 'media', 'avatar',
    'notification', 'alert', 'toast', 'message', 'error', 'success',
    'loading', 'spinner', 'skeleton', 'placeholder'
  ]);

  // Action keywords (help identify task type)
  const actions = new Set([
    'add', 'create', 'implement', 'build', 'make',
    'fix', 'repair', 'resolve', 'debug', 'patch',
    'update', 'modify', 'change', 'edit', 'refactor',
    'remove', 'delete', 'clean', 'optimize',
    'test', 'validate', 'check', 'verify'
  ]);

  const result = {
    high: [],    // High-value component/feature keywords
    medium: [],  // Regular keywords
    actions: []  // Action verbs
  };

  for (const word of words) {
    if (word.length < 3) continue;

    if (highValue.has(word)) {
      result.high.push(word);
    } else if (actions.has(word)) {
      result.actions.push(word);
    } else if (word.length >= 4) {
      result.medium.push(word);
    }
  }

  // Also extract PascalCase/camelCase terms (likely component names)
  const caseTerms = description.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)*/g) || [];
  for (const term of caseTerms) {
    if (!result.high.includes(term.toLowerCase())) {
      result.high.push(term);
    }
  }

  return result;
}

// ============================================================
// Context Sources
// ============================================================

/**
 * Search app-map.md for matching components
 */
function searchAppMap(keywords) {
  const results = [];
  const appMapPath = PATHS.appMap;

  if (!fs.existsSync(appMapPath)) return results;

  try {
    const content = fs.readFileSync(appMapPath, 'utf-8');
    const lines = content.split('\n');

    const allKeywords = [...keywords.high, ...keywords.medium];

    for (const keyword of allKeywords) {
      const regex = new RegExp(keyword, 'gi');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          // Extract component info from nearby lines
          const contextStart = Math.max(0, i - 2);
          const contextEnd = Math.min(lines.length, i + 5);
          const context = lines.slice(contextStart, contextEnd).join('\n');

          // Try to extract file path
          const pathMatch = context.match(/`([^`]+\.(tsx?|jsx?|vue))`/);
          if (pathMatch) {
            results.push({
              source: 'app-map',
              keyword,
              path: pathMatch[1],
              context: context.slice(0, 200),
              score: keywords.high.includes(keyword) ? 3 : 1
            });
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return results;
}

/**
 * Search component-index.json for matching files
 */
function searchComponentIndex(keywords) {
  const results = [];
  const indexPath = path.join(PATHS.state, 'component-index.json');

  if (!fs.existsSync(indexPath)) return results;

  try {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const components = index.components || [];

    const allKeywords = [...keywords.high, ...keywords.medium];

    for (const comp of components) {
      const name = (comp.name || '').toLowerCase();
      const filePath = comp.path || '';

      for (const keyword of allKeywords) {
        const kw = keyword.toLowerCase();
        if (name.includes(kw) || filePath.toLowerCase().includes(kw)) {
          results.push({
            source: 'component-index',
            keyword,
            path: filePath,
            name: comp.name,
            exports: comp.exports || [],
            score: keywords.high.includes(keyword) ? 3 : 1
          });
          break; // Don't add same component multiple times
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return results;
}

/**
 * Grep codebase for keyword matches
 */
function grepCodebase(keywords, maxResults = 10) {
  const results = [];
  const srcDir = path.join(PROJECT_ROOT, 'src');

  if (!fs.existsSync(srcDir)) return results;

  // Only grep for high-value keywords to avoid noise
  const searchKeywords = keywords.high.slice(0, 5);

  for (const keyword of searchKeywords) {
    try {
      // Case-insensitive grep for the keyword
      const output = execSync(
        `grep -ril "${keyword}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" "${srcDir}" 2>/dev/null | head -5`,
        { encoding: 'utf-8', timeout: 5000 }
      );

      const files = output.split('\n').filter(f => f.trim());
      for (const file of files) {
        const relPath = path.relative(PROJECT_ROOT, file);
        if (!results.some(r => r.path === relPath)) {
          results.push({
            source: 'grep',
            keyword,
            path: relPath,
            score: 2
          });
        }
      }
    } catch {
      // Ignore grep errors (no matches, timeout, etc.)
    }

    if (results.length >= maxResults) break;
  }

  return results;
}

/**
 * Search ready.json for related tasks
 */
function searchRelatedTasks(keywords) {
  const results = [];

  if (!fs.existsSync(PATHS.ready)) return results;

  try {
    const data = JSON.parse(fs.readFileSync(PATHS.ready, 'utf-8'));
    const allTasks = [
      ...(data.ready || []),
      ...(data.inProgress || []),
      ...(data.recentlyCompleted || []).slice(0, 5)
    ];

    const allKeywords = [...keywords.high, ...keywords.medium];

    for (const task of allTasks) {
      const title = typeof task === 'string' ? task : (task.title || task.id || '');
      const titleLower = title.toLowerCase();

      for (const keyword of allKeywords) {
        if (titleLower.includes(keyword.toLowerCase())) {
          results.push({
            source: 'related-task',
            keyword,
            taskId: typeof task === 'string' ? task : task.id,
            title,
            score: 1
          });
          break;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return results;
}

// ============================================================
// Main Context Loading
// ============================================================

/**
 * Get auto-context for a task description
 * Returns prioritized list of relevant files and context
 */
function getAutoContext(description, options = {}) {
  const config = getConfig();

  // Check if auto-context is enabled
  if (config.autoContext?.enabled === false) {
    return { enabled: false, files: [], context: [] };
  }

  const maxFiles = options.maxFiles || config.autoContext?.maxFilesToLoad || 10;
  const showFiles = options.showFiles ?? config.autoContext?.showLoadedFiles ?? true;

  // Extract keywords
  const keywords = extractKeywords(description);

  if (keywords.high.length === 0 && keywords.medium.length === 0) {
    return {
      enabled: true,
      files: [],
      context: [],
      message: 'No specific keywords found in task description'
    };
  }

  // Gather context from all sources
  const allResults = [
    ...searchAppMap(keywords),
    ...searchComponentIndex(keywords),
    ...grepCodebase(keywords),
    ...searchRelatedTasks(keywords)
  ];

  // Dedupe by path and sort by score
  const seen = new Set();
  const unique = [];

  for (const result of allResults) {
    const key = result.path || result.taskId || result.keyword;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }

  // Sort by score (higher first)
  unique.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Take top results
  const topResults = unique.slice(0, maxFiles);

  // Extract unique file paths
  const files = topResults
    .filter(r => r.path)
    .map(r => r.path);

  // Build context summary
  const context = {
    keywords: {
      high: keywords.high,
      medium: keywords.medium.slice(0, 5),
      actions: keywords.actions
    },
    sources: {
      appMap: topResults.filter(r => r.source === 'app-map').length,
      componentIndex: topResults.filter(r => r.source === 'component-index').length,
      grep: topResults.filter(r => r.source === 'grep').length,
      relatedTasks: topResults.filter(r => r.source === 'related-task').length
    },
    relatedTasks: topResults
      .filter(r => r.source === 'related-task')
      .map(r => ({ id: r.taskId, title: r.title }))
  };

  return {
    enabled: true,
    files,
    results: topResults,
    context,
    message: files.length > 0
      ? `Found ${files.length} relevant file(s)`
      : 'No directly relevant files found'
  };
}

/**
 * Format auto-context results for display
 */
function formatAutoContext(result) {
  if (!result.enabled) {
    return `${colors.dim}Auto-context disabled${colors.reset}`;
  }

  let output = '';

  if (result.files.length > 0) {
    output += `${colors.cyan}📂 Auto-loaded context:${colors.reset}\n`;
    for (const file of result.files.slice(0, 8)) {
      output += `   ${colors.dim}•${colors.reset} ${file}\n`;
    }
    if (result.files.length > 8) {
      output += `   ${colors.dim}... and ${result.files.length - 8} more${colors.reset}\n`;
    }
  } else {
    output += `${colors.dim}No specific files matched. Proceeding with general context.${colors.reset}\n`;
  }

  if (result.context?.relatedTasks?.length > 0) {
    output += `\n${colors.cyan}📋 Related tasks:${colors.reset}\n`;
    for (const task of result.context.relatedTasks.slice(0, 3)) {
      output += `   ${colors.dim}•${colors.reset} ${task.id}: ${task.title}\n`;
    }
  }

  return output;
}

// ============================================================
// CLI
// ============================================================

function showHelp() {
  console.log(`
Wogi Flow - Auto Context Loading

Analyzes task descriptions and automatically loads relevant context.

Usage:
  flow auto-context "task description"
  flow auto-context --json "task description"

Options:
  --json       Output as JSON
  --verbose    Show all matched results
  --max N      Maximum files to load (default: 10)
  --help, -h   Show this help

Examples:
  flow auto-context "implement user authentication"
  flow auto-context "fix the login form validation"
  flow auto-context "add a new Button variant"
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const jsonOutput = args.includes('--json');
  const verbose = args.includes('--verbose');

  // Extract max files option
  const maxIndex = args.indexOf('--max');
  const maxFiles = maxIndex >= 0 ? parseInt(args[maxIndex + 1]) || 10 : 10;

  // Get description (everything that's not a flag)
  const description = args
    .filter(a => !a.startsWith('--') && !(maxIndex >= 0 && args[maxIndex + 1] === a))
    .join(' ');

  if (!description) {
    console.log(`${colors.red}Error: Please provide a task description${colors.reset}`);
    showHelp();
    process.exit(1);
  }

  const result = getAutoContext(description, { maxFiles });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatAutoContext(result));

    if (verbose && result.results) {
      console.log(`\n${colors.bold}All matches:${colors.reset}`);
      for (const r of result.results) {
        console.log(`  [${r.source}] ${r.path || r.taskId || r.keyword} (score: ${r.score})`);
      }
    }
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  extractKeywords,
  searchAppMap,
  searchComponentIndex,
  grepCodebase,
  searchRelatedTasks,
  getAutoContext,
  formatAutoContext
};

if (require.main === module) {
  main();
}
