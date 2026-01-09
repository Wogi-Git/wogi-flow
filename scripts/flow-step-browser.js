#!/usr/bin/env node

/**
 * Wogi Flow - Browser Test Step
 *
 * Workflow step wrapper for browser test suggestions.
 * Suggests running browser tests for UI changes.
 */

const fs = require('fs');
const path = require('path');
const { getProjectRoot, colors, getConfig } = require('./flow-utils');

const PROJECT_ROOT = getProjectRoot();
const TESTS_DIR = path.join(PROJECT_ROOT, '.workflow', 'tests', 'flows');

/**
 * Run browser test step
 *
 * @param {object} options
 * @param {string[]} options.files - Files modified in this task
 * @param {string} options.taskId - Current task ID
 * @param {object} options.stepConfig - Step configuration
 * @param {string} options.mode - Step mode (block/warn/prompt/auto)
 * @returns {object} - { passed: boolean, message: string, suggestion?: string }
 */
async function run(options = {}) {
  const { files = [], mode, stepConfig = {} } = options;

  // Check if we have any UI files
  const uiExtensions = ['.tsx', '.jsx', '.vue', '.svelte'];
  const uiFiles = files.filter(f => uiExtensions.some(ext => f.endsWith(ext)));

  if (uiFiles.length === 0) {
    return { passed: true, message: 'No UI files modified' };
  }

  // Check if browser tests exist
  if (!fs.existsSync(TESTS_DIR)) {
    return {
      passed: true,
      message: 'No browser test flows configured',
      suggestion: 'Consider adding browser tests in .workflow/tests/flows/',
    };
  }

  // Find available test flows
  const testFlows = fs.readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));

  if (testFlows.length === 0) {
    return {
      passed: true,
      message: 'No browser test flows found',
      suggestion: 'Add test flows to .workflow/tests/flows/',
    };
  }

  // In prompt mode, suggest tests
  if (mode === 'prompt') {
    console.log(colors.yellow + '\n  UI files modified:' + colors.reset);
    uiFiles.forEach(f => console.log(`    - ${f}`));
    console.log(colors.yellow + '\n  Available browser tests:' + colors.reset);
    testFlows.forEach(f => console.log(`    - ${f.replace(/\.(json|ya?ml)$/, '')}`));
    console.log(colors.cyan + '\n  Run with: /wogi-test-browser <flow-name>' + colors.reset);

    return {
      passed: true,
      message: 'Browser tests suggested',
      suggestion: `/wogi-test-browser ${testFlows[0].replace(/\.(json|ya?ml)$/, '')}`,
    };
  }

  // In auto mode, we could run tests automatically
  // For now, just mark as passed with suggestion
  return {
    passed: true,
    message: `${uiFiles.length} UI file(s) modified, browser tests available`,
    suggestion: 'Run browser tests to verify UI changes',
  };
}

module.exports = { run };
