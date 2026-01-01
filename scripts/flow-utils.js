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
};

// ============================================================
// Colors (ANSI escape codes)
// ============================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  magenta: '\x1b[0;35m',
  cyan: '\x1b[0;36m',
  white: '\x1b[0;37m',
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
function readJson(filePath, defaultValue = null) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    if (defaultValue !== null) {
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
function readFile(filePath, defaultValue = null) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    if (defaultValue !== null) {
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

/**
 * Read workflow config
 */
function getConfig() {
  return readJson(PATHS.config, {});
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

// ============================================================
// Git Operations
// ============================================================

/**
 * Check if current directory is a git repo
 */
function isGitRepo() {
  return dirExists(path.join(PROJECT_ROOT, '.git'));
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
 * Count files recursively
 */
function countFiles(dirPath, extensions = []) {
  let count = 0;

  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          if (extensions.length === 0 || extensions.some(ext => entry.name.endsWith(ext))) {
            count++;
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  if (dirExists(dirPath)) {
    walk(dirPath);
  }

  return count;
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

  // Ready.json
  getReadyData,
  saveReadyData,
  findTask,
  moveTask,
  getTaskCounts,

  // Request Log
  countRequestLogEntries,
  getLastRequestLogEntry,

  // App Map
  countAppMapComponents,

  // Git
  isGitRepo,
  getGitStatus,

  // Directory
  listDirs,
  listFiles,
  countFiles,
};
