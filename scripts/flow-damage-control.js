#!/usr/bin/env node

/**
 * Wogi Flow - Damage Control System
 *
 * Prevents destructive commands from running accidentally.
 * Based on patterns.yaml configuration and AI prompt hook (optional).
 *
 * Usage:
 *   flow damage-control check "<command>"   Check if command is allowed
 *   flow damage-control status              Show damage control status
 *   flow damage-control enable              Enable damage control
 *   flow dc check "rm -rf node_modules"     Shorthand
 */

const fs = require('fs');
const path = require('path');
const { getProjectRoot, colors, getConfig } = require('./flow-utils');

const PROJECT_ROOT = getProjectRoot();
const WORKFLOW_DIR = path.join(PROJECT_ROOT, '.workflow');
const PATTERNS_FILE = path.join(WORKFLOW_DIR, 'damage-control.yaml');

function log(color, ...args) {
  console.log(colors[color] + args.join(' ') + colors.reset);
}

// Commands that are always safe (read-only)
const SAFE_COMMANDS = [
  /^ls\b/,
  /^cat\b/,
  /^head\b/,
  /^tail\b/,
  /^grep\b/,
  /^rg\b/,
  /^find\b/,
  /^git\s+(status|log|diff|branch|show|remote|tag)\b/,
  /^npm\s+(test|run|list|ls|view|search|info)\b/,
  /^node\s+--check\b/,
  /^node\s+-c\b/,
  /^echo\b/,
  /^pwd\b/,
  /^which\b/,
  /^type\b/,
  /^whoami\b/,
  /^hostname\b/,
  /^date\b/,
  /^wc\b/,
  /^sort\b/,
  /^uniq\b/,
  /^diff\b/,
  /^file\b/,
  /^tree\b/,
  /^du\b/,
  /^df\b/
];

/**
 * Process YAML escape sequences in double-quoted strings
 * Handles: \\ -> \, \n -> newline, \t -> tab, \" -> "
 */
function processYamlEscapes(str) {
  return str
    .replace(/\\\\/g, '\x00')      // Temporarily replace \\ with placeholder
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\x00/g, '\\');        // Restore \\ as single \
}

/**
 * Simple YAML parser for our specific format
 * Handles: comments, key-value, arrays, nested objects (2 levels)
 */
function parseSimpleYaml(content) {
  const result = { blocked: [], ask: [], paths: {} };
  const lines = content.split('\n');

  let currentSection = null;
  let currentSubSection = null;
  let currentObject = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Check indentation level
    const indent = line.search(/\S/);

    // Top-level key (no indent): blocked:, ask:, paths:
    if (indent === 0 && trimmed.endsWith(':')) {
      currentSection = trimmed.slice(0, -1);
      currentSubSection = null;
      currentObject = null;

      if (currentSection === 'paths' && !result.paths) {
        result.paths = {};
      } else if (!result[currentSection]) {
        result[currentSection] = [];
      }
      continue;
    }

    // Sub-section under paths (indent 2): zeroAccess:, readOnly:, noDelete:
    if (currentSection === 'paths' && indent === 2 && trimmed.endsWith(':')) {
      currentSubSection = trimmed.slice(0, -1);
      result.paths[currentSubSection] = result.paths[currentSubSection] || [];
      continue;
    }

    // Array item (starts with -)
    if (trimmed.startsWith('-')) {
      const value = trimmed.slice(1).trim();

      // Check if this is a key-value pair in the array item: - pattern: "..."
      if (value.includes(':') && !value.startsWith('"') && !value.startsWith("'")) {
        // Start of an object in array - split only on first colon to preserve colons in values
        const colonIndex = value.indexOf(':');
        const key = value.slice(0, colonIndex).trim();
        const val = value.slice(colonIndex + 1).trim();
        const rawVal = val.replace(/^["']|["']$/g, '');
        currentObject = { [key]: val.startsWith('"') ? processYamlEscapes(rawVal) : rawVal };
      } else {
        // Simple string value
        const rawValue = value.replace(/^["']|["']$/g, '');
        const cleanValue = value.startsWith('"') ? processYamlEscapes(rawValue) : rawValue;

        if (currentSection === 'paths' && currentSubSection) {
          result.paths[currentSubSection].push(cleanValue);
        } else if (currentSection && currentObject === null) {
          result[currentSection].push(cleanValue);
        }
        currentObject = null;
      }
      continue;
    }

    // Continuation of object in array (indent 4+): reason: "..."
    if (currentObject && trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIndex).trim();
      const rawVal = trimmed.slice(colonIndex + 1).trim();
      const strippedVal = rawVal.replace(/^["']|["']$/g, '');
      currentObject[key] = rawVal.startsWith('"') ? processYamlEscapes(strippedVal) : strippedVal;

      // Check if next line continues this object
      const nextLine = lines[i + 1];
      const nextIndent = nextLine ? nextLine.search(/\S/) : 0;
      const nextTrimmed = nextLine ? nextLine.trim() : '';

      // If next line is a new array item or less indented, push current object
      if (!nextLine || nextIndent <= 2 || nextTrimmed.startsWith('-')) {
        if (currentSection) {
          result[currentSection].push(currentObject);
        }
        currentObject = null;
      }
    }
  }

  return result;
}

/**
 * Load damage control patterns from YAML file
 */
function loadPatterns() {
  const config = getConfig();
  const dcConfig = config.damageControl || {};
  const patternsPath = dcConfig.patternsFile
    ? path.join(PROJECT_ROOT, dcConfig.patternsFile)
    : PATTERNS_FILE;

  if (!fs.existsSync(patternsPath)) {
    return {
      blocked: [],
      ask: [],
      paths: { zeroAccess: [], readOnly: [], noDelete: [] }
    };
  }

  try {
    const content = fs.readFileSync(patternsPath, 'utf-8');
    return parseSimpleYaml(content);
  } catch (e) {
    console.error('Error loading damage-control.yaml:', e.message);
    return {
      blocked: [],
      ask: [],
      paths: { zeroAccess: [], readOnly: [], noDelete: [] }
    };
  }
}

/**
 * Check if command is safe (read-only)
 */
function isSafeCommand(cmd) {
  const normalizedCmd = cmd.trim();
  return SAFE_COMMANDS.some(pattern => pattern.test(normalizedCmd));
}

/**
 * Check command against patterns
 * Returns: { action: 'allow' | 'block' | 'ask', reason?: string }
 */
function checkCommand(cmd) {
  const config = getConfig();
  const dcConfig = config.damageControl || {};

  if (!dcConfig.enabled) {
    return { action: 'allow' };
  }

  // Skip safe commands
  if (isSafeCommand(cmd)) {
    return { action: 'allow', reason: 'Safe command' };
  }

  const patterns = loadPatterns();

  // Check blocked patterns
  for (const pattern of patterns.blocked || []) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(cmd)) {
        return {
          action: 'block',
          reason: `Matches blocked pattern: ${pattern}`,
          pattern
        };
      }
    } catch (e) {
      // Invalid regex, skip
      console.error(`Invalid regex pattern: ${pattern}`);
    }
  }

  // Check ask patterns
  for (const item of patterns.ask || []) {
    const pattern = typeof item === 'string' ? item : item.pattern;
    const reason = typeof item === 'object' ? item.reason : 'Matches sensitive pattern';

    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(cmd)) {
        return {
          action: 'ask',
          reason,
          pattern
        };
      }
    } catch (e) {
      // Invalid regex, skip
      console.error(`Invalid regex pattern: ${pattern}`);
    }
  }

  return { action: 'allow' };
}

/**
 * Check if a path matches a pattern using proper path segment matching
 * Prevents false positives like "node_modules" matching "node_modules_backup"
 */
function pathMatchesPattern(normalizedPath, pattern) {
  // Normalize pattern too
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // If pattern is an absolute path or contains path separators, do exact segment matching
  if (normalizedPattern.includes('/')) {
    // Check if the path contains the pattern as a segment sequence
    return normalizedPath.includes(normalizedPattern) &&
           (normalizedPath === normalizedPattern ||
            normalizedPath.startsWith(normalizedPattern + '/') ||
            normalizedPath.endsWith('/' + normalizedPattern) ||
            normalizedPath.includes('/' + normalizedPattern + '/'));
  }

  // For simple names (no path separator), match as directory/file name segment
  const segments = normalizedPath.split('/');
  return segments.some(segment => segment === normalizedPattern);
}

/**
 * Check if path operation is allowed
 * Returns: { allowed: boolean, reason?: string, level?: string }
 */
function checkPath(filePath, operation) {
  const config = getConfig();
  const dcConfig = config.damageControl || {};

  if (!dcConfig.enabled) {
    return { allowed: true };
  }

  const patterns = loadPatterns();
  const paths = patterns.paths || {};

  // Normalize path (handle both forward and backslashes)
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Zero access - block all operations (read, write, delete)
  for (const p of paths.zeroAccess || []) {
    if (pathMatchesPattern(normalizedPath, p)) {
      return {
        allowed: false,
        reason: `Zero access path: ${p}`,
        level: 'zeroAccess'
      };
    }
  }

  // Read-only - block write/delete
  if (operation === 'write' || operation === 'delete') {
    for (const p of paths.readOnly || []) {
      if (pathMatchesPattern(normalizedPath, p)) {
        return {
          allowed: false,
          reason: `Read-only path: ${p}`,
          level: 'readOnly'
        };
      }
    }
  }

  // No-delete - block delete only
  if (operation === 'delete') {
    for (const p of paths.noDelete || []) {
      if (pathMatchesPattern(normalizedPath, p)) {
        return {
          allowed: false,
          reason: `No-delete path: ${p}`,
          level: 'noDelete'
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * AI prompt hook for unknown dangerous commands
 * Returns: { action: 'allow' | 'block' | 'ask', reason?: string }
 *
 * Note: Full implementation requires API integration.
 * This is a stub that can be enhanced with actual AI call.
 */
async function promptHookCheck(cmd) {
  const config = getConfig();
  const dcConfig = config.damageControl || {};
  const promptConfig = dcConfig.promptHook || {};

  if (!dcConfig.enabled || !promptConfig.enabled) {
    return { action: 'allow' };
  }

  // Skip if already caught by patterns
  const patternResult = checkCommand(cmd);
  if (patternResult.action !== 'allow') {
    return patternResult;
  }

  // Skip safe commands
  if (isSafeCommand(cmd)) {
    return { action: 'allow', reason: 'Safe command' };
  }

  // TODO: Implement actual AI API call
  // For now, return allow with a note
  return {
    action: 'allow',
    reason: 'Prompt hook enabled but API not yet integrated'
  };
}

/**
 * Get status of damage control system
 */
function getStatus() {
  const config = getConfig();
  const dcConfig = config.damageControl || {};
  const patterns = loadPatterns();

  return {
    enabled: dcConfig.enabled || false,
    promptHook: {
      enabled: dcConfig.promptHook?.enabled || false,
      model: dcConfig.promptHook?.model || 'haiku'
    },
    patternsFile: dcConfig.patternsFile || '.workflow/damage-control.yaml',
    patternsLoaded: {
      blocked: (patterns.blocked || []).length,
      ask: (patterns.ask || []).length,
      paths: {
        zeroAccess: (patterns.paths?.zeroAccess || []).length,
        readOnly: (patterns.paths?.readOnly || []).length,
        noDelete: (patterns.paths?.noDelete || []).length
      }
    },
    safeCommandPatterns: SAFE_COMMANDS.length
  };
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (args.includes('--help') || args.includes('-h') || !command) {
    console.log(`
Wogi-Flow Damage Control

Prevents destructive commands from running accidentally.

Usage:
  flow damage-control check "<command>"   Check if command is allowed
  flow damage-control path "<path>" <op>  Check if path operation is allowed
  flow damage-control status              Show damage control status
  flow damage-control patterns            List all patterns

Operations for path check: read, write, delete

Examples:
  flow dc check "rm -rf node_modules"
  flow dc check "git reset --hard"
  flow dc path "/home/user/.ssh/id_rsa" read
  flow dc status

Configuration (config.json):
  "damageControl": {
    "enabled": false,
    "patternsFile": ".workflow/damage-control.yaml",
    "promptHook": {
      "enabled": false,
      "model": "haiku"
    }
  }
`);
    process.exit(0);
  }

  switch (command) {
    case 'check': {
      const cmd = args.slice(1).join(' ');
      if (!cmd) {
        log('red', 'Error: Command to check is required');
        log('dim', 'Usage: flow dc check "<command>"');
        process.exit(1);
      }
      const result = checkCommand(cmd);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'path': {
      const filePath = args[1];
      const operation = args[2] || 'read';
      if (!filePath) {
        log('red', 'Error: Path is required');
        log('dim', 'Usage: flow dc path "<path>" <operation>');
        process.exit(1);
      }
      const result = checkPath(filePath, operation);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'status': {
      const status = getStatus();
      console.log('');
      log('cyan', 'Damage Control Status');
      console.log('');
      log('white', `  Enabled: ${status.enabled ? colors.green + 'Yes' : colors.yellow + 'No'}${colors.reset}`);
      log('white', `  Prompt Hook: ${status.promptHook.enabled ? colors.green + 'Yes' : colors.dim + 'No'}${colors.reset}`);
      log('white', `  Patterns File: ${status.patternsFile}`);
      console.log('');
      log('cyan', 'Patterns Loaded:');
      log('white', `  Blocked: ${status.patternsLoaded.blocked}`);
      log('white', `  Ask: ${status.patternsLoaded.ask}`);
      log('white', `  Zero Access Paths: ${status.patternsLoaded.paths.zeroAccess}`);
      log('white', `  Read-Only Paths: ${status.patternsLoaded.paths.readOnly}`);
      log('white', `  No-Delete Paths: ${status.patternsLoaded.paths.noDelete}`);
      log('white', `  Safe Command Patterns: ${status.safeCommandPatterns}`);
      console.log('');

      if (!status.enabled) {
        log('dim', 'To enable: Set damageControl.enabled to true in config.json');
      }
      break;
    }

    case 'patterns': {
      const patterns = loadPatterns();
      console.log('');
      log('cyan', 'Blocked Patterns:');
      (patterns.blocked || []).forEach(p => log('red', `  - ${p}`));
      console.log('');
      log('cyan', 'Ask Patterns:');
      (patterns.ask || []).forEach(p => {
        if (typeof p === 'object') {
          log('yellow', `  - ${p.pattern}`);
          log('dim', `    Reason: ${p.reason}`);
        } else {
          log('yellow', `  - ${p}`);
        }
      });
      console.log('');
      log('cyan', 'Protected Paths:');
      log('white', '  Zero Access:');
      (patterns.paths?.zeroAccess || []).forEach(p => log('red', `    - ${p}`));
      log('white', '  Read-Only:');
      (patterns.paths?.readOnly || []).forEach(p => log('yellow', `    - ${p}`));
      log('white', '  No-Delete:');
      (patterns.paths?.noDelete || []).forEach(p => log('yellow', `    - ${p}`));
      break;
    }

    default:
      log('red', `Unknown command: ${command}`);
      log('dim', 'Run: flow dc --help for usage');
      process.exit(1);
  }
}

// Export for use by other modules
module.exports = {
  loadPatterns,
  parseSimpleYaml,
  isSafeCommand,
  checkCommand,
  checkPath,
  promptHookCheck,
  getStatus,
  SAFE_COMMANDS
};
