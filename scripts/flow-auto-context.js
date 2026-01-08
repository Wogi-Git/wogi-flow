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
const {
  getProjectRoot,
  getConfig,
  PATHS,
  colors,
  isAstGrepAvailable,
  astGrepSearch,
  AST_PATTERNS,
  findReactComponents,
  findCustomHooks,
  findTypeDefinitions
} = require('./flow-utils');

const PROJECT_ROOT = getProjectRoot();

// ============================================================
// Index Freshness Check
// ============================================================

/**
 * Check if component index is stale and refresh if needed
 * @param {object} config - Config object with componentIndex settings
 * @returns {boolean} - True if index was refreshed
 */
function checkAndRefreshIndex(config) {
  const indexPath = path.join(PATHS.state, 'component-index.json');

  if (!fs.existsSync(indexPath)) {
    return false; // No index to refresh
  }

  const staleAfterMinutes = config.componentIndex?.staleAfterMinutes || 60;
  const scanOn = config.componentIndex?.scanOn || [];

  // Only check if sessionStart is a trigger
  if (!scanOn.includes('sessionStart')) {
    return false;
  }

  try {
    const stats = fs.statSync(indexPath);
    const ageMs = Date.now() - stats.mtimeMs;
    const staleMs = staleAfterMinutes * 60 * 1000;

    if (ageMs > staleMs) {
      // Index is stale - refresh it
      execSync('bash scripts/flow-map-index scan --quiet', {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 30000 // 30 second timeout
      });
      return true;
    }
  } catch {
    // Ignore errors - stale check is best-effort
  }

  return false;
}

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

/**
 * Infer task type from extracted keywords
 * Used to customize AST-grep search patterns
 */
function inferTaskType(keywords) {
  const allKeywords = [...keywords.high, ...keywords.medium, ...keywords.actions].map(k => k.toLowerCase());

  // PRIORITY 1: Check for action keywords first (fix, refactor take precedence)
  // These override noun-based detection since "refactor auth service" should be refactor, not create-service

  // Check for fix/bug keywords
  if (allKeywords.some(k => ['fix', 'bug', 'issue', 'error', 'broken'].includes(k))) {
    return 'fix-bug';
  }

  // Check for refactor keywords
  if (allKeywords.some(k => ['refactor', 'cleanup', 'optimize', 'improve', 'reorganize'].includes(k))) {
    return 'refactor';
  }

  // PRIORITY 2: Check for creation patterns (create/add/new + noun)

  // Check for component-related keywords
  if (allKeywords.some(k => ['component', 'button', 'form', 'modal', 'card', 'dialog', 'page', 'view', 'ui'].includes(k))) {
    if (allKeywords.includes('create') || allKeywords.includes('add') || allKeywords.includes('new')) {
      return 'create-component';
    }
    return 'modify-component';
  }

  // Check for hook-related keywords
  // Common React hooks (lowercase, as keywords are lowercased)
  const reactHooks = ['usestate', 'useeffect', 'usecontext', 'usereducer', 'usecallback',
    'usememo', 'useref', 'useimperativehandle', 'uselayouteffect', 'usedebugvalue',
    'usetransition', 'usedeferredvalue', 'useid', 'usesyncexternalstore', 'useinsertioneffect'];
  const isHookKeyword = (k) => {
    if (k === 'hook' || k === 'state' || k === 'effect') return true;
    // Match known React hooks
    if (reactHooks.includes(k)) return true;
    // Match custom hooks: useXyz where it's not a common word like "user", "used", "useful"
    if (k.startsWith('use') && k.length > 4 && !['user', 'used', 'uses', 'useful'].includes(k)) {
      return true;
    }
    return false;
  };
  if (allKeywords.some(isHookKeyword)) {
    if (allKeywords.includes('create') || allKeywords.includes('add') || allKeywords.includes('new')) {
      return 'create-hook';
    }
    return 'modify-hook';
  }

  // Check for service/API keywords
  if (allKeywords.some(k => ['api', 'service', 'fetch', 'request', 'endpoint'].includes(k))) {
    if (allKeywords.includes('create') || allKeywords.includes('add') || allKeywords.includes('new')) {
      return 'create-service';
    }
    return 'modify-service';
  }

  return 'generic';
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
 * @param {object} keywords - Extracted keywords object
 * @param {object} config - Config object with autoContext settings
 */
function searchComponentIndex(keywords, config = null) {
  const results = [];
  const indexPath = path.join(PATHS.state, 'component-index.json');

  if (!fs.existsSync(indexPath)) return results;

  // Use config values if available
  const cfg = config || getConfig();
  const maxComponentMatches = cfg.autoContext?.maxComponentMatches || 15;

  try {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const components = index.components || [];

    const allKeywords = [...keywords.high, ...keywords.medium];
    let totalMatches = 0;

    for (const comp of components) {
      const name = (comp.name || '').toLowerCase();
      const filePath = comp.path || '';

      for (const keyword of allKeywords) {
        const kw = keyword.toLowerCase();
        if (name.includes(kw) || filePath.toLowerCase().includes(kw)) {
          totalMatches++;
          if (results.length < maxComponentMatches) {
            results.push({
              source: 'component-index',
              keyword,
              path: filePath,
              name: comp.name,
              exports: comp.exports || [],
              score: keywords.high.includes(keyword) ? 3 : 1
            });
          }
          break; // Don't add same component multiple times
        }
      }
    }

    // Add truncation notice if we limited results
    if (totalMatches > maxComponentMatches) {
      results.push({
        source: 'truncation_notice',
        message: `... and ${totalMatches - maxComponentMatches} more component matches (limited to ${maxComponentMatches})`,
        score: 0
      });
    }
  } catch {
    // Ignore errors
  }

  return results;
}

/**
 * Grep codebase for keyword matches
 * @param {object} keywords - Extracted keywords object
 * @param {number} maxResults - Maximum results to return
 * @param {object} config - Config object with autoContext settings
 */
function grepCodebase(keywords, maxResults = 10, config = null) {
  const results = [];
  const srcDir = path.join(PROJECT_ROOT, 'src');

  if (!fs.existsSync(srcDir)) return results;

  // Use config values if available
  const cfg = config || getConfig();
  const effectiveMaxResults = cfg.autoContext?.maxGrepResults || maxResults;
  const maxContentLines = cfg.autoContext?.maxContentLines || 50;

  // Only grep for high-value keywords to avoid noise
  const searchKeywords = keywords.high.slice(0, 5);
  let totalMatches = 0;

  for (const keyword of searchKeywords) {
    try {
      // Case-insensitive grep for the keyword
      const output = execSync(
        `grep -ril "${keyword}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" "${srcDir}" 2>/dev/null | head -20`,
        { encoding: 'utf-8', timeout: 5000 }
      );

      const files = output.split('\n').filter(f => f.trim());
      totalMatches += files.length;

      for (const file of files) {
        if (results.length >= effectiveMaxResults) break;

        const relPath = path.relative(PROJECT_ROOT, file);
        if (!results.some(r => r.path === relPath)) {
          // Optionally read file content with truncation
          let content = null;
          if (cfg.autoContext?.includeContent) {
            try {
              const fullContent = fs.readFileSync(file, 'utf-8');
              const lines = fullContent.split('\n');
              if (lines.length > maxContentLines) {
                content = [
                  ...lines.slice(0, maxContentLines),
                  `\n... ${lines.length - maxContentLines} more lines truncated ...`
                ].join('\n');
              } else {
                content = fullContent;
              }
            } catch {
              // Ignore read errors
            }
          }

          results.push({
            source: 'grep',
            keyword,
            path: relPath,
            content,
            score: 2
          });
        }
      }
    } catch {
      // Ignore grep errors (no matches, timeout, etc.)
    }

    if (results.length >= effectiveMaxResults) break;
  }

  // Add truncation notice if we limited results
  if (totalMatches > effectiveMaxResults) {
    results.push({
      source: 'truncation_notice',
      message: `... and ${totalMatches - effectiveMaxResults} more grep matches (limited to ${effectiveMaxResults})`,
      score: 0
    });
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

/**
 * Search codebase using AST-grep for structural patterns
 * Falls back gracefully if ast-grep is not installed
 *
 * @param {object} keywords - Extracted keywords
 * @param {string} taskType - Type of task (create-component, create-hook, etc.)
 * @param {object} config - Config object
 */
function searchWithAstGrep(keywords, taskType = null, config = null) {
  const cfg = config || getConfig();

  // Skip if disabled or ast-grep not available
  if (!cfg.autoContext?.useAstGrep || !isAstGrepAvailable()) {
    return [];
  }

  const results = [];
  const maxResults = cfg.autoContext?.maxAstGrepResults || 5;

  try {
    // Determine search strategy based on task type
    if (taskType === 'create-component' || keywords.high.some(k =>
      ['component', 'button', 'form', 'modal', 'card', 'list'].includes(k.toLowerCase())
    )) {
      // Find similar React components for reference
      const components = findReactComponents({ maxResults: maxResults * 2 });
      if (components) {
        for (const comp of components.slice(0, maxResults)) {
          results.push({
            source: 'ast-grep',
            type: 'component',
            path: comp.file,
            line: comp.line,
            preview: comp.content?.slice(0, 100),
            score: 2.5  // Higher than grep, lower than app-map
          });
        }
      }
    }

    if (taskType === 'create-hook' || keywords.high.some(k =>
      ['hook', 'usestate', 'useeffect', 'usememo'].includes(k.toLowerCase())
    )) {
      // Find existing hooks for patterns
      const hooks = findCustomHooks({ maxResults });
      if (hooks) {
        for (const hook of hooks.slice(0, Math.ceil(maxResults / 2))) {
          results.push({
            source: 'ast-grep',
            type: 'hook',
            path: hook.file,
            line: hook.line,
            preview: hook.content?.slice(0, 100),
            score: 2.5
          });
        }
      }
    }

    // Search for type definitions matching keywords
    for (const keyword of keywords.high.slice(0, 3)) {
      const types = findTypeDefinitions(keyword, { maxResults: 2 });
      if (types && types.length > 0) {
        for (const type of types) {
          if (!results.some(r => r.path === type.file)) {
            results.push({
              source: 'ast-grep',
              type: 'type-definition',
              keyword,
              path: type.file,
              line: type.line,
              preview: type.content?.slice(0, 100),
              score: 2.5
            });
          }
        }
      }
    }

    // Generic pattern search for high-value keywords
    for (const keyword of keywords.high.slice(0, 2)) {
      // Search for exported functions/consts with this name
      const pattern = `export $_ ${keyword}$_`;
      const matches = astGrepSearch(pattern, { maxResults: 2 });
      if (matches) {
        for (const match of matches) {
          if (!results.some(r => r.path === match.file)) {
            results.push({
              source: 'ast-grep',
              type: 'export',
              keyword,
              path: match.file,
              line: match.line,
              score: 2
            });
          }
        }
      }
    }
  } catch (err) {
    // Graceful fallback - AST-grep is optional
    if (cfg.debug) {
      console.warn(`AST-grep search failed: ${err.message}`);
    }
  }

  // Truncate if too many results
  if (results.length > maxResults * 2) {
    const truncated = results.slice(0, maxResults * 2);
    truncated.push({
      source: 'truncation_notice',
      message: `... and ${results.length - maxResults * 2} more AST matches`,
      score: 0
    });
    return truncated;
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

  // v2.0: Check and refresh stale component index
  if (config.componentIndex?.autoScan !== false) {
    checkAndRefreshIndex(config);
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

  // Determine task type from keywords/options for ast-grep
  const taskType = options.taskType || inferTaskType(keywords);

  // Gather context from all sources (pass config for truncation settings)
  const allResults = [
    ...searchAppMap(keywords),
    ...searchComponentIndex(keywords, config),
    ...searchWithAstGrep(keywords, taskType, config),  // AST-grep search (if enabled)
    ...grepCodebase(keywords, 10, config),
    ...searchRelatedTasks(keywords)
  ];

  // Collect truncation notices separately
  const truncationNotices = allResults.filter(r => r.source === 'truncation_notice');
  const actualResults = allResults.filter(r => r.source !== 'truncation_notice');

  // Dedupe by path and sort by score
  const seen = new Set();
  const unique = [];

  for (const result of actualResults) {
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
      .map(r => ({ id: r.taskId, title: r.title })),
    truncated: truncationNotices.length > 0,
    truncationNotices: truncationNotices.map(t => t.message)
  };

  return {
    enabled: true,
    files,
    results: topResults,
    context,
    truncationNotices,
    message: files.length > 0
      ? `Found ${files.length} relevant file(s)${truncationNotices.length > 0 ? ' (results truncated)' : ''}`
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

  // Show truncation notices if any
  if (result.truncationNotices?.length > 0) {
    output += `\n${colors.dim}ℹ️  Results truncated:${colors.reset}\n`;
    for (const notice of result.truncationNotices) {
      output += `   ${colors.dim}${notice}${colors.reset}\n`;
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
  searchWithAstGrep,
  inferTaskType,
  checkAndRefreshIndex,
  getAutoContext,
  formatAutoContext
};

if (require.main === module) {
  main();
}
