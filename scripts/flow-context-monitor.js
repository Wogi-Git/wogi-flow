#!/usr/bin/env node

/**
 * Wogi Flow - Context Monitor
 *
 * Monitors estimated context usage and triggers warnings/prompts
 * at configurable thresholds. Helps prevent context overflow.
 *
 * Part of v1.7.0 Context Memory Management
 */

const fs = require('fs');
const path = require('path');
const {
  getConfig,
  PATHS,
  STATE_DIR,
  PROJECT_ROOT,
  colors,
  color,
  warn,
  success,
  readFile,
  fileExists,
  printHeader
} = require('./flow-utils');

// ============================================================
// Token Estimation
// ============================================================

/**
 * Estimate tokens from text
 * Uses different ratios for prose vs code content:
 * - Prose: ~4 chars = 1 token
 * - Code: ~3 chars = 1 token (more token-dense)
 */
function estimateTokens(text, isCode = false) {
  if (!text) return 0;
  // Code is more token-dense due to keywords, punctuation, short variable names
  const charsPerToken = isCode ? 3 : 4;
  return Math.ceil(text.length / charsPerToken);
}

/**
 * Detect if content is primarily code (for token estimation)
 */
function isCodeContent(content) {
  if (!content || content.length < 100) return false;
  // Simple heuristics: code has more brackets, semicolons, imports
  const codeIndicators = (content.match(/[{}\[\]();=]/g) || []).length;
  const ratio = codeIndicators / content.length;
  return ratio > 0.03; // More than 3% is likely code
}

/**
 * Estimate tokens for a file
 */
function estimateFileTokens(filePath) {
  try {
    if (!fileExists(filePath)) return 0;
    const content = fs.readFileSync(filePath, 'utf-8');
    // Use code estimation for code files
    const isCode = /\.(js|ts|jsx|tsx|json|css|scss)$/.test(filePath) || isCodeContent(content);
    return estimateTokens(content, isCode);
  } catch {
    return 0;
  }
}

// ============================================================
// Context Size Calculation
// ============================================================

/**
 * Get current context size from all state files
 * Returns breakdown by file and total
 */
function getContextBreakdown() {
  const files = {
    'progress.md': PATHS.progress,
    'request-log.md': PATHS.requestLog,
    'decisions.md': PATHS.decisions,
    'app-map.md': PATHS.appMap,
    'feedback-patterns.md': PATHS.feedbackPatterns,
  };

  const breakdown = {};
  let total = 0;

  for (const [name, filePath] of Object.entries(files)) {
    const tokens = estimateFileTokens(filePath);
    breakdown[name] = tokens;
    total += tokens;
  }

  // Also check component detail files
  const componentsDir = PATHS.components;
  let componentTokens = 0;
  if (fs.existsSync(componentsDir)) {
    try {
      const componentFiles = fs.readdirSync(componentsDir)
        .filter(f => f.endsWith('.md'));
      for (const file of componentFiles) {
        componentTokens += estimateFileTokens(path.join(componentsDir, file));
      }
    } catch {
      // Ignore errors
    }
  }
  breakdown['components/'] = componentTokens;
  total += componentTokens;

  return { breakdown, total };
}

/**
 * Get total current context size in tokens
 */
function getCurrentContextSize() {
  return getContextBreakdown().total;
}

// ============================================================
// Health Check
// ============================================================

/**
 * Default configuration values
 */
const DEFAULTS = {
  enabled: true,
  warnAt: 0.7,        // 70% - warning threshold
  criticalAt: 0.85,   // 85% - critical threshold
  contextWindow: 200000, // Claude's context window
  checkOnSessionStart: true,
  checkAfterTask: true
};

/**
 * Get context monitor configuration
 */
function getContextMonitorConfig() {
  const config = getConfig();
  return {
    ...DEFAULTS,
    ...(config.contextMonitor || {})
  };
}

/**
 * Check context health and return status
 */
function checkContextHealth() {
  const config = getContextMonitorConfig();

  if (!config.enabled) {
    return {
      status: 'disabled',
      currentTokens: 0,
      contextWindow: config.contextWindow,
      usage: 0,
      recommendation: null
    };
  }

  const { breakdown, total } = getContextBreakdown();
  const usage = total / config.contextWindow;

  let status, recommendation;

  if (usage >= config.criticalAt) {
    status = 'critical';
    recommendation = 'Run /compact NOW to avoid context overflow';
  } else if (usage >= config.warnAt) {
    status = 'warning';
    recommendation = 'Consider running /compact soon';
  } else {
    status = 'healthy';
    recommendation = null;
  }

  return {
    status,
    currentTokens: total,
    contextWindow: config.contextWindow,
    usage,
    usagePercent: Math.round(usage * 100),
    recommendation,
    breakdown,
    thresholds: {
      warn: config.warnAt,
      critical: config.criticalAt
    }
  };
}

// ============================================================
// Warning Display
// ============================================================

/**
 * Display context health warning if needed
 * Returns true if critical warning was shown
 */
function warnIfContextHigh() {
  const health = checkContextHealth();

  if (health.status === 'disabled') {
    return false;
  }

  if (health.status === 'critical') {
    console.log('');
    console.log(color('bgRed', color('white', ' CRITICAL ')));
    console.log(color('red', `Context at ${health.usagePercent}% (${health.currentTokens.toLocaleString()} tokens)`));
    console.log(color('red', health.recommendation));
    console.log('');
    return true;
  }

  if (health.status === 'warning') {
    console.log('');
    console.log(color('yellow', `Context at ${health.usagePercent}% - ${health.recommendation}`));
    console.log('');
  }

  return false;
}

/**
 * Display detailed context breakdown
 */
function showContextBreakdown() {
  const health = checkContextHealth();

  printHeader('Context Usage');

  // Status indicator
  const statusColors = {
    healthy: 'green',
    warning: 'yellow',
    critical: 'red',
    disabled: 'dim'
  };
  const statusColor = statusColors[health.status] || 'white';
  console.log(`Status: ${color(statusColor, health.status.toUpperCase())}`);
  console.log('');

  // Progress bar
  const barWidth = 40;
  const filled = Math.min(Math.round(health.usage * barWidth), barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  console.log(`[${color(statusColor, bar)}] ${health.usagePercent}%`);
  console.log(`${health.currentTokens.toLocaleString()} / ${health.contextWindow.toLocaleString()} tokens`);
  console.log('');

  // Breakdown
  console.log(color('cyan', 'Breakdown:'));
  const sortedBreakdown = Object.entries(health.breakdown)
    .sort((a, b) => b[1] - a[1]);

  for (const [file, tokens] of sortedBreakdown) {
    if (tokens > 0) {
      const percent = Math.round((tokens / health.currentTokens) * 100);
      console.log(`  ${file.padEnd(25)} ${tokens.toLocaleString().padStart(8)} tokens (${percent}%)`);
    }
  }
  console.log('');

  // Thresholds
  console.log(color('dim', `Thresholds: warn=${Math.round(health.thresholds.warn * 100)}%, critical=${Math.round(health.thresholds.critical * 100)}%`));

  // Recommendation
  if (health.recommendation) {
    console.log('');
    console.log(color(statusColor, health.recommendation));
  }
}

/**
 * Get a brief status line for inline display
 */
function getStatusLine() {
  const health = checkContextHealth();

  if (health.status === 'disabled') {
    return null;
  }

  const icon = health.status === 'healthy' ? '●' :
               health.status === 'warning' ? '◐' : '○';
  const colorName = health.status === 'healthy' ? 'green' :
                    health.status === 'warning' ? 'yellow' : 'red';

  return color(colorName, `${icon} Context: ${health.usagePercent}%`);
}

// ============================================================
// CLI Interface
// ============================================================

function printUsage() {
  console.log(`
Usage: flow-context-monitor.js [command]

Commands:
  check         Check context health and show warnings
  breakdown     Show detailed context breakdown
  status        Show brief status line
  --help        Show this help

Examples:
  node scripts/flow-context-monitor.js check
  node scripts/flow-context-monitor.js breakdown
`);
}

// Main CLI handler
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';

  switch (command) {
    case 'check':
      const critical = warnIfContextHigh();
      if (!critical) {
        const health = checkContextHealth();
        if (health.status === 'healthy') {
          success(`Context healthy (${health.usagePercent}%)`);
        }
      }
      break;

    case 'breakdown':
      showContextBreakdown();
      break;

    case 'status':
      const line = getStatusLine();
      if (line) {
        console.log(line);
      } else {
        console.log('Context monitor disabled');
      }
      break;

    case '--help':
    case '-h':
      printUsage();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Token estimation
  estimateTokens,
  estimateFileTokens,

  // Context size
  getContextBreakdown,
  getCurrentContextSize,

  // Health check
  checkContextHealth,
  getContextMonitorConfig,

  // Warnings
  warnIfContextHigh,
  showContextBreakdown,
  getStatusLine,

  // Constants
  DEFAULTS
};
