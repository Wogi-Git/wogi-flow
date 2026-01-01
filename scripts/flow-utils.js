#!/usr/bin/env node

/**
 * Wogi Flow - Shared Utilities
 *
 * Common functions used across all flow scripts.
 * Eliminates Python dependency and provides consistent path handling.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// Project Root Detection
// ============================================================

/**
 * Find the project root directory using multiple strategies:
 * 1. Git root (most reliable in monorepos and submodules)
 * 2. Walk up looking for .workflow directory
 * 3. Fall back to process.cwd()
 *
 * @returns {string} Absolute path to project root
 */
function getProjectRoot() {
  // Strategy 1: Try git root (works in submodules, worktrees, and nested repos)
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'] // Suppress stderr
    }).trim();

    if (gitRoot && fs.existsSync(gitRoot)) {
      // Verify this git root has .workflow (could be parent repo in monorepo)
      if (fs.existsSync(path.join(gitRoot, '.workflow'))) {
        return gitRoot;
      }
    }
  } catch {
    // Not in a git repo or git not available
  }

  // Strategy 2: Walk up from cwd looking for .workflow
  let current = process.cwd();
  const root = path.parse(current).root;

  while (current !== root) {
    const workflowPath = path.join(current, '.workflow');
    if (fs.existsSync(workflowPath) && fs.statSync(workflowPath).isDirectory()) {
      return current;
    }
    current = path.dirname(current);
  }

  // Strategy 3: Fall back to cwd (for new projects without .workflow yet)
  return process.cwd();
}

// ============================================================
// Paths
// ============================================================

const PROJECT_ROOT = getProjectRoot();
const WORKFLOW_DIR = path.join(PROJECT_ROOT, '.workflow');
const STATE_DIR = path.join(WORKFLOW_DIR, 'state');

const PATHS = {
  root: PROJECT_ROOT,
  workflow: WORKFLOW_DIR,
  state: STATE_DIR,
  config: path.join(WORKFLOW_DIR, 'config.json'),
  ready: path.join(STATE_DIR, 'ready.json'),
  requestLog: path.join(STATE_DIR, 'request-log.md'),
  appMap: path.join(STATE_DIR, 'app-map.md'),
  decisions: path.join(STATE_DIR, 'decisions.md'),
  progress: path.join(STATE_DIR, 'progress.md'),
  feedbackPatterns: path.join(STATE_DIR, 'feedback-patterns.md'),
  components: path.join(STATE_DIR, 'components'),
  changes: path.join(WORKFLOW_DIR, 'changes'),
  bugs: path.join(WORKFLOW_DIR, 'bugs'),
  archive: path.join(WORKFLOW_DIR, 'archive'),
  specs: path.join(WORKFLOW_DIR, 'specs'),
  // Additional workflow directories
  runs: path.join(WORKFLOW_DIR, 'runs'),
  checkpoints: path.join(WORKFLOW_DIR, 'checkpoints'),
  corrections: path.join(WORKFLOW_DIR, 'corrections'),
  traces: path.join(WORKFLOW_DIR, 'traces'),
  // Factory AI-inspired features
  commandMetrics: path.join(STATE_DIR, 'command-metrics.json'),
  modelStats: path.join(STATE_DIR, 'model-stats.json'),
  approaches: path.join(STATE_DIR, 'approaches'),
  modelAdapters: path.join(WORKFLOW_DIR, 'model-adapters'),
  codebaseInsights: path.join(STATE_DIR, 'codebase-insights.md'),
};

// ============================================================
// Colors (ANSI escape codes)
// ============================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

/**
 * Colorize text for terminal output
 */
function color(colorName, text) {
  return `${colors[colorName] || ''}${text}${colors.reset}`;
}

/**
 * Print colored output
 */
function print(colorName, text) {
  console.log(color(colorName, text));
}

/**
 * Print a styled header
 */
function printHeader(title) {
  console.log(color('cyan', '═'.repeat(50)));
  console.log(color('cyan', `        ${title}`));
  console.log(color('cyan', '═'.repeat(50)));
  console.log('');
}

/**
 * Print a section title
 */
function printSection(title) {
  console.log(color('cyan', title));
}

/**
 * Print success message
 */
function success(message) {
  console.log(`${color('green', '✓')} ${message}`);
}

/**
 * Print warning message
 */
function warn(message) {
  console.log(`${color('yellow', '⚠')} ${message}`);
}

/**
 * Print error message
 */
function error(message) {
  console.log(`${color('red', '✗')} ${message}`);
}

// ============================================================
// File Operations
// ============================================================

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
function dirExists(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read JSON file safely
 */
function readJson(filePath, defaultValue = undefined) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    // Check for undefined to allow falsy defaults like false, 0, ''
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Failed to read JSON from ${filePath}: ${e.message}`);
  }
}

/**
 * Write JSON file with pretty formatting
 */
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    return true;
  } catch (e) {
    throw new Error(`Failed to write JSON to ${filePath}: ${e.message}`);
  }
}

/**
 * Read text file safely
 */
function readFile(filePath, defaultValue = undefined) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    // Check for undefined to allow falsy defaults like false, 0, ''
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Failed to read file ${filePath}: ${e.message}`);
  }
}

/**
 * Write text file
 */
function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content);
    return true;
  } catch (e) {
    throw new Error(`Failed to write file ${filePath}: ${e.message}`);
  }
}

/**
 * Validate JSON file syntax
 */
function validateJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    JSON.parse(content);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ============================================================
// Config Operations
// ============================================================

// Config cache for performance (avoids repeated file reads)
let _configCache = null;
let _configMtime = null;

// Known config keys for validation (prevents typos causing silent failures)
const KNOWN_CONFIG_KEYS = [
  'hybrid',
  'parallel',
  'worktree',
  'qualityGates',
  'testing',
  'componentRules',
  'mandatorySteps',
  'phases',
  'corrections',
  'skills',
  'autoContext',
  'metrics',
  'figmaAnalyzer',
  'learning',
  'hooks',
  'project',
  'projectType'
];

// Known nested keys for common config sections
const KNOWN_NESTED_KEYS = {
  hybrid: ['enabled', 'provider', 'providerEndpoint', 'model', 'settings', 'maxContextTokens', 'apiKey'],
  parallel: ['enabled', 'maxConcurrent', 'autoApprove', 'requireWorktree', 'showProgress'],
  worktree: ['enabled', 'autoCleanupHours', 'keepOnFailure', 'squashOnMerge'],
  testing: ['runAfterTask', 'runBeforeCommit', 'command'],
  learning: ['autoPromote', 'enabled', 'threshold', 'mode'],
  qualityGates: ['feature', 'bugfix'],
  autoContext: ['enabled', 'maxFiles', 'searchDepth']
};

/**
 * Validate config object for unknown keys
 * Warns about typos that could cause silent failures
 */
function validateConfig(config, warnOnUnknown = true) {
  if (!warnOnUnknown || !config || typeof config !== 'object') return;

  const warnings = [];

  // Check top-level keys
  for (const key of Object.keys(config)) {
    if (!KNOWN_CONFIG_KEYS.includes(key)) {
      warnings.push(`Unknown config key: "${key}"`);
    }
  }

  // Check known nested sections
  for (const [section, knownKeys] of Object.entries(KNOWN_NESTED_KEYS)) {
    const sectionConfig = config[section];
    if (sectionConfig && typeof sectionConfig === 'object') {
      for (const key of Object.keys(sectionConfig)) {
        if (!knownKeys.includes(key)) {
          warnings.push(`Unknown key in ${section}: "${key}"`);
        }
      }
    }
  }

  // Only warn once per session (avoid spam)
  if (warnings.length > 0 && !_configValidationDone) {
    _configValidationDone = true;
    for (const warning of warnings) {
      console.warn(`⚠️  ${warning}`);
    }
    console.warn('   Check for typos in .workflow/config.json');
  }
}

// Track if we've already warned about config issues this session
let _configValidationDone = false;

/**
 * Read workflow config (cached, invalidates on file change)
 */
function getConfig() {
  const configPath = PATHS.config;
  if (!fs.existsSync(configPath)) return {};

  try {
    const stat = fs.statSync(configPath);
    if (_configCache && _configMtime === stat.mtimeMs) {
      return _configCache;
    }

    _configCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    _configMtime = stat.mtimeMs;

    // Validate on first load (DEBUG mode or explicit request)
    if (process.env.DEBUG || process.env.VALIDATE_CONFIG) {
      validateConfig(_configCache);
    }

    return _configCache;
  } catch (err) {
    // Log warning instead of silently returning empty config
    console.warn(`Warning: Could not parse config.json: ${err.message}`);
    return {};
  }
}

/**
 * Invalidate config cache (call after writing config)
 */
function invalidateConfigCache() {
  _configCache = null;
  _configMtime = null;
}

/**
 * Get a config value by path (e.g., 'testing.runBeforeCommit')
 */
function getConfigValue(configPath, defaultValue = null) {
  const config = getConfig();
  const parts = configPath.split('.');
  let value = config;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return defaultValue;
    }
  }

  return value;
}

/**
 * Update config value
 */
function setConfigValue(configPath, newValue) {
  const config = getConfig();
  const parts = configPath.split('.');
  let obj = config;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in obj)) {
      obj[part] = {};
    }
    obj = obj[part];
  }

  obj[parts[parts.length - 1]] = newValue;
  writeJson(PATHS.config, config);
  // Invalidate cache after writing to ensure next getConfig() reads fresh data
  invalidateConfigCache();
}

// ============================================================
// Ready.json Operations
// ============================================================

/**
 * Read ready.json task queue
 */
function getReadyData() {
  return readJson(PATHS.ready, {
    ready: [],
    inProgress: [],
    blocked: [],
    recentlyCompleted: []
  });
}

/**
 * Write ready.json task queue
 */
function saveReadyData(data) {
  data.lastUpdated = new Date().toISOString();
  return writeJson(PATHS.ready, data);
}

/**
 * Find a task in ready.json by ID
 * Returns { task, list, index } or null
 */
function findTask(taskId) {
  const data = getReadyData();
  const lists = ['ready', 'inProgress', 'blocked', 'recentlyCompleted'];

  for (const listName of lists) {
    const list = data[listName] || [];
    for (let i = 0; i < list.length; i++) {
      const task = list[i];
      const id = typeof task === 'string' ? task : task.id;
      if (id === taskId) {
        return { task, list: listName, index: i, data };
      }
    }
  }

  return null;
}

/**
 * Move a task from one list to another
 */
function moveTask(taskId, fromList, toList) {
  const data = getReadyData();
  const from = data[fromList] || [];
  const to = data[toList] || [];

  let taskIndex = -1;
  let task = null;

  for (let i = 0; i < from.length; i++) {
    const t = from[i];
    const id = typeof t === 'string' ? t : t.id;
    if (id === taskId) {
      taskIndex = i;
      task = t;
      break;
    }
  }

  if (taskIndex === -1) {
    return { success: false, error: `Task ${taskId} not found in ${fromList}` };
  }

  from.splice(taskIndex, 1);

  if (toList === 'recentlyCompleted') {
    to.unshift(task);
    data[toList] = to.slice(0, 10); // Keep last 10
  } else {
    to.push(task);
    data[toList] = to;
  }

  data[fromList] = from;
  saveReadyData(data);

  return { success: true, task };
}

/**
 * Get task counts
 */
function getTaskCounts() {
  const data = getReadyData();
  return {
    ready: (data.ready || []).length,
    inProgress: (data.inProgress || []).length,
    blocked: (data.blocked || []).length,
    recentlyCompleted: (data.recentlyCompleted || []).length
  };
}

// ============================================================
// Request Log Operations
// ============================================================

/**
 * Count entries in request-log.md
 */
function countRequestLogEntries() {
  try {
    const content = readFile(PATHS.requestLog, '');
    const matches = content.match(/^### R-/gm);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Get the last request log entry
 */
function getLastRequestLogEntry() {
  try {
    const content = readFile(PATHS.requestLog, '');
    const matches = content.match(/^### R-.*$/gm);
    return matches ? matches[matches.length - 1] : null;
  } catch {
    return null;
  }
}

/**
 * Get next request ID
 */
function getNextRequestId() {
  const count = countRequestLogEntries();
  return `R-${String(count + 1).padStart(3, '0')}`;
}

/**
 * Add an entry to request-log.md
 * @param {Object} entry - Entry details
 * @param {string} entry.type - new | fix | change | refactor
 * @param {string[]} entry.tags - Array of tags (e.g., ['#figma', '#component:Button'])
 * @param {string} entry.request - What was requested
 * @param {string} entry.result - What was done
 * @param {string[]} [entry.files] - Files changed
 */
function addRequestLogEntry(entry) {
  const { type, tags, request, result, files = [] } = entry;
  const id = getNextRequestId();
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 16);

  const filesLine = files.length > 0 ? `\n**Files**: ${files.join(', ')}` : '';
  const tagsStr = tags.join(' ');

  const logEntry = `
### ${id} | ${timestamp}
**Type**: ${type}
**Tags**: ${tagsStr}
**Request**: "${request}"
**Result**: ${result}${filesLine}
`;

  try {
    const content = readFile(PATHS.requestLog, '');
    writeFile(PATHS.requestLog, content + logEntry);
    return id;
  } catch (e) {
    error(`Failed to add request log entry: ${e.message}`);
    return null;
  }
}

// ============================================================
// App Map Operations
// ============================================================

/**
 * Count components in app-map.md
 */
function countAppMapComponents() {
  try {
    const content = readFile(PATHS.appMap, '');
    const matches = content.match(/^\|/gm);
    // Subtract header rows (approximately 6)
    const count = matches ? Math.max(0, matches.length - 6) : 0;
    return count;
  } catch {
    return 0;
  }
}

/**
 * Add a component to app-map.md
 * @param {Object} component - Component details
 * @param {string} component.name - Component name
 * @param {string} component.type - Component type (component, screen, modal, etc.)
 * @param {string} component.path - Path to component file
 * @param {string[]} [component.variants] - Available variants
 * @param {string} [component.description] - Component description
 * @returns {boolean} - Success status
 */
function addAppMapComponent(component) {
  const { name, type, path: filePath, variants = [], description = '' } = component;

  try {
    let content = readFile(PATHS.appMap, '');

    // Find the appropriate section based on type
    const sectionMap = {
      screen: '## Screens',
      modal: '## Modals',
      component: '## Components',
      layout: '## Layouts'
    };

    const section = sectionMap[type] || '## Components';
    const variantsStr = variants.length > 0 ? variants.join(', ') : '-';
    const descStr = description || '-';

    // Create new row
    const newRow = `| ${name} | ${filePath} | ${variantsStr} | ${descStr} |`;

    // Find section and add row
    const sectionIndex = content.indexOf(section);
    if (sectionIndex === -1) {
      warn(`Section "${section}" not found in app-map.md`);
      return false;
    }

    // Find the end of the table in this section (next section or end of file)
    const nextSectionMatch = content.substring(sectionIndex + section.length).match(/\n## /);
    const endIndex = nextSectionMatch
      ? sectionIndex + section.length + nextSectionMatch.index
      : content.length;

    // Find last table row in section
    const sectionContent = content.substring(sectionIndex, endIndex);
    const lastPipeIndex = sectionContent.lastIndexOf('\n|');

    if (lastPipeIndex !== -1) {
      // Find the end of the last row (next newline after the pipe)
      const afterPipe = sectionContent.substring(lastPipeIndex);
      const newlineOffset = afterPipe.indexOf('\n', 1);
      // If no newline found, insert at end of section content
      const insertOffset = newlineOffset !== -1 ? newlineOffset : afterPipe.length;
      const insertIndex = sectionIndex + lastPipeIndex + insertOffset;
      content = content.substring(0, insertIndex) + '\n' + newRow + content.substring(insertIndex);
    } else {
      // No table rows yet, add after header
      const headerEnd = sectionContent.indexOf('\n\n');
      if (headerEnd !== -1) {
        const insertIndex = sectionIndex + headerEnd;
        content = content.substring(0, insertIndex) + '\n' + newRow + content.substring(insertIndex);
      } else {
        // Malformed section - no header end found
        warn(`Could not find proper insertion point in section "${section}"`);
        return false;
      }
    }

    writeFile(PATHS.appMap, content);
    return true;
  } catch (e) {
    error(`Failed to add component to app-map: ${e.message}`);
    return false;
  }
}

// ============================================================
// Git Operations
// ============================================================

/**
 * Check if current directory is a git repo
 * Note: .git can be a directory (normal repo) or file (worktree)
 */
function isGitRepo() {
  const gitPath = path.join(PROJECT_ROOT, '.git');
  return fs.existsSync(gitPath);
}

/**
 * Get git status info (requires child_process)
 */
function getGitStatus() {
  const { execSync } = require('child_process');

  if (!isGitRepo()) {
    return { isRepo: false };
  }

  try {
    const branch = execSync('git branch --show-current', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const uncommitted = status.split('\n').filter(Boolean).length;

    return {
      isRepo: true,
      branch,
      uncommitted,
      clean: uncommitted === 0
    };
  } catch (e) {
    return { isRepo: true, error: e.message };
  }
}

// ============================================================
// Directory Operations
// ============================================================

/**
 * List directories in a path
 */
function listDirs(dirPath) {
  try {
    if (!dirExists(dirPath)) return [];
    return fs.readdirSync(dirPath)
      .filter(name => {
        const fullPath = path.join(dirPath, name);
        return fs.statSync(fullPath).isDirectory();
      });
  } catch {
    return [];
  }
}

/**
 * List files matching a pattern in a directory
 */
function listFiles(dirPath, extension = null) {
  try {
    if (!dirExists(dirPath)) return [];
    return fs.readdirSync(dirPath)
      .filter(name => {
        const fullPath = path.join(dirPath, name);
        if (!fs.statSync(fullPath).isFile()) return false;
        if (extension && !name.endsWith(extension)) return false;
        return true;
      });
  } catch {
    return [];
  }
}

/**
 * Count files recursively with depth limit and symlink protection
 */
function countFiles(dirPath, extensions = [], maxDepth = 10) {
  let count = 0;
  const visited = new Set(); // Prevent infinite loops from symlinks

  function walk(dir, depth) {
    if (depth <= 0) return; // Depth limit reached

    try {
      // Resolve real path to detect symlink cycles
      const realPath = fs.realpathSync(dir);
      if (visited.has(realPath)) return; // Already visited (symlink cycle)
      visited.add(realPath);

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        // Skip node_modules and hidden directories for performance
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          walk(fullPath, depth - 1);
        } else if (entry.isFile()) {
          if (extensions.length === 0 || extensions.some(ext => entry.name.endsWith(ext))) {
            count++;
          }
        }
      }
    } catch (err) {
      // Ignore permission errors, log others in debug mode
      if (process.env.DEBUG) console.error(`[DEBUG] countFiles: ${err.message}`);
    }
  }

  if (dirExists(dirPath)) {
    walk(dirPath, maxDepth);
  }

  return count;
}

// ============================================================
// File Locking (for parallel execution safety)
// ============================================================

/**
 * Simple file locking without external dependencies.
 * Uses mkdir (atomic on most filesystems) for lock acquisition.
 *
 * @param {string} filePath - File to lock
 * @param {Object} options - Lock options
 * @param {number} [options.retries=5] - Number of retry attempts
 * @param {number} [options.retryDelay=100] - Delay between retries (ms)
 * @param {number} [options.staleMs=30000] - Consider lock stale after this many ms
 * @returns {Promise<Function>} Release function
 */
async function acquireLock(filePath, options = {}) {
  const {
    retries = 5,
    retryDelay = 100,
    staleMs = 30000
  } = options;

  const lockDir = `${filePath}.lock`;
  const lockInfoFile = path.join(lockDir, 'info.json');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // mkdir is atomic - will fail if directory already exists
      fs.mkdirSync(lockDir, { recursive: false });

      // Write lock info for stale detection
      fs.writeFileSync(lockInfoFile, JSON.stringify({
        pid: process.pid,
        timestamp: Date.now(),
        file: filePath
      }));

      // Return release function
      return () => {
        try {
          fs.unlinkSync(lockInfoFile);
          fs.rmdirSync(lockDir);
        } catch {
          // Lock already released or cleaned up
        }
      };
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock exists - check if stale
        try {
          const info = JSON.parse(fs.readFileSync(lockInfoFile, 'utf-8'));
          const age = Date.now() - info.timestamp;

          if (age > staleMs) {
            // Stale lock - force cleanup
            if (process.env.DEBUG) {
              console.warn(`[DEBUG] Removing stale lock (${age}ms old) for ${filePath}`);
            }
            try {
              fs.unlinkSync(lockInfoFile);
              fs.rmdirSync(lockDir);
            } catch {
              // May have been cleaned up by another process
            }
            // Try again immediately
            continue;
          }
        } catch {
          // Can't read lock info - treat as stale after delay
        }

        if (attempt < retries) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }
      }

      throw new Error(`Failed to acquire lock for ${filePath}: ${err.message}`);
    }
  }

  throw new Error(`Failed to acquire lock for ${filePath} after ${retries} retries`);
}

/**
 * Execute a function while holding a lock on a file
 *
 * @param {string} filePath - File to lock
 * @param {Function} fn - Async function to execute
 * @param {Object} [options] - Lock options
 * @returns {Promise<*>} Result of fn
 *
 * @example
 * const data = await withLock(PATHS.ready, async () => {
 *   const current = readJson(PATHS.ready);
 *   current.tasks.push(newTask);
 *   writeJson(PATHS.ready, current);
 *   return current;
 * });
 */
async function withLock(filePath, fn, options = {}) {
  const release = await acquireLock(filePath, options);
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Synchronous version of withLock for simpler use cases
 * Note: Still uses async for lock acquisition, but fn is sync
 */
async function withLockSync(filePath, fn, options = {}) {
  const release = await acquireLock(filePath, options);
  try {
    return fn();
  } finally {
    release();
  }
}

/**
 * Clean up any stale locks in a directory
 * Useful for cleanup after crashes
 */
function cleanupStaleLocks(dirPath, staleMs = 30000) {
  try {
    if (!dirExists(dirPath)) return 0;

    let cleaned = 0;
    const entries = fs.readdirSync(dirPath);

    for (const entry of entries) {
      if (!entry.endsWith('.lock')) continue;

      const lockDir = path.join(dirPath, entry);
      const lockInfoFile = path.join(lockDir, 'info.json');

      try {
        const info = JSON.parse(fs.readFileSync(lockInfoFile, 'utf-8'));
        const age = Date.now() - info.timestamp;

        if (age > staleMs) {
          fs.unlinkSync(lockInfoFile);
          fs.rmdirSync(lockDir);
          cleaned++;
        }
      } catch {
        // Can't read - try to remove anyway if old enough
        try {
          const stat = fs.statSync(lockDir);
          const age = Date.now() - stat.mtimeMs;
          if (age > staleMs) {
            fs.rmSync(lockDir, { recursive: true, force: true });
            cleaned++;
          }
        } catch {
          // Ignore
        }
      }
    }

    return cleaned;
  } catch {
    return 0;
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Paths
  PATHS,
  PROJECT_ROOT,
  WORKFLOW_DIR,
  STATE_DIR,
  getProjectRoot,

  // Colors & Output
  colors,
  color,
  print,
  printHeader,
  printSection,
  success,
  warn,
  error,

  // File Operations
  fileExists,
  dirExists,
  readJson,
  writeJson,
  readFile,
  writeFile,
  validateJson,

  // Config
  getConfig,
  getConfigValue,
  setConfigValue,
  invalidateConfigCache,
  validateConfig,
  KNOWN_CONFIG_KEYS,

  // Ready.json
  getReadyData,
  saveReadyData,
  findTask,
  moveTask,
  getTaskCounts,

  // Request Log
  countRequestLogEntries,
  getLastRequestLogEntry,
  getNextRequestId,
  addRequestLogEntry,

  // App Map
  countAppMapComponents,
  addAppMapComponent,

  // Git
  isGitRepo,
  getGitStatus,

  // Directory
  listDirs,
  listFiles,
  countFiles,

  // File Locking
  acquireLock,
  withLock,
  withLockSync,
  cleanupStaleLocks,
};
