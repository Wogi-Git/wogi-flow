#!/usr/bin/env node

/**
 * Wogi Flow - Claude Code SessionEnd Hook
 *
 * Called when a Claude Code session ends.
 * Auto-logs to request-log.md and warns about uncommitted work.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { claudeCodeAdapter } = require('../../adapters/claude-code');

// Import from parent scripts directory
const { getConfig, PATHS } = require('../../../flow-utils');

/**
 * Get uncommitted file count
 */
function getUncommittedCount() {
  try {
    const output = execSync('git status --porcelain', {
      cwd: PATHS.root,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.trim().split('\n').filter(line => line.trim()).length;
  } catch {
    return 0;
  }
}

/**
 * Check if auto-logging is enabled
 */
function isAutoLoggingEnabled() {
  const config = getConfig();
  return config.hooks?.rules?.autoLogging?.enabled !== false;
}

async function main() {
  try {
    // Read input from stdin
    let inputData = '';
    for await (const chunk of process.stdin) {
      inputData += chunk;
    }

    const input = inputData ? JSON.parse(inputData) : {};
    const parsedInput = claudeCodeAdapter.parseInput(input);

    const result = {
      logged: false,
      warning: null
    };

    // Check for uncommitted work
    const uncommitted = getUncommittedCount();
    if (uncommitted > 0) {
      result.warning = `${uncommitted} uncommitted file${uncommitted !== 1 ? 's' : ''}. Consider committing before ending session.`;
    }

    // Auto-logging would go here but requires more session context
    // For now, just warn about uncommitted work
    if (isAutoLoggingEnabled()) {
      // Could integrate with flow-session-end.js in the future
      result.logged = false;
    }

    // Transform to Claude Code format
    const output = claudeCodeAdapter.transformResult('SessionEnd', result);

    // Output JSON
    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    // Non-blocking error
    console.error(`[Wogi Flow Hook Error] ${err.message}`);
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

// Handle stdin properly
process.stdin.setEncoding('utf8');
main();
