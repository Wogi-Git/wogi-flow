#!/usr/bin/env node

/**
 * Wogi Flow - Complete Task
 *
 * Runs quality gates and moves task from inProgress to completed.
 */

const { execSync, execFileSync, spawnSync } = require('child_process');
const path = require('path');
const {
  PATHS,
  fileExists,
  getConfig,
  moveTask,
  findTask,
  readFile,
  writeJson,
  color,
  success,
  warn,
  error
} = require('./flow-utils');

// v1.7.0 context memory management
const { warnIfContextHigh } = require('./flow-context-monitor');
const { clearCurrentTask, addKeyFact } = require('./flow-memory-blocks');
const { trackTaskComplete } = require('./flow-session-state');
const { autoArchiveIfNeeded } = require('./flow-log-manager');

// v1.9.0 regression testing and browser test suggestions
const { runRegressionTests } = require('./flow-regression');
const { suggestBrowserTests } = require('./flow-browser-suggest');

// v2.0 durable session support
const { loadDurableSession, archiveDurableSession } = require('./flow-durable-session');

// Path for last failure artifact
const LAST_FAILURE_PATH = path.join(PATHS.state, 'last-failure.json');

/**
 * Truncate error output to reasonable length
 */
function truncateOutput(text, maxLines = 30, maxChars = 2000) {
  if (!text) return '';
  const lines = text.split('\n').slice(0, maxLines);
  let result = lines.join('\n');
  if (result.length > maxChars) {
    result = result.substring(0, maxChars) + '\n... (truncated)';
  }
  return result;
}

/**
 * Run quality gates from config
 */
function runQualityGates(taskId) {
  if (!fileExists(PATHS.config)) {
    return { passed: true, failed: [], errors: {} };
  }

  console.log(color('yellow', 'Running quality gates...'));
  console.log('');

  const config = getConfig();
  const gates = config.qualityGates?.feature?.require || [];
  const testing = config.testing || {};
  const failed = [];
  const errors = {}; // Store error output for correction artifact

  for (const gate of gates) {
    if (gate === 'tests') {
      if (testing.runAfterTask || testing.runBeforeCommit) {
        console.log('  Running tests...');
        const result = spawnSync('npm', ['test'], {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        if (result.status === 0) {
          console.log(`  ${color('green', '✓')} tests passed`);
        } else {
          console.log(`  ${color('red', '✗')} tests failed`);
          // Capture error output
          const errorOutput = result.stderr || result.stdout || '';
          if (errorOutput) {
            console.log(color('dim', '  Error output:'));
            const truncated = truncateOutput(errorOutput, 20, 1000);
            truncated.split('\n').forEach(line => {
              console.log(color('dim', `    ${line}`));
            });
          }
          errors.tests = errorOutput;
          failed.push('tests');
        }
      } else {
        console.log(`  ${color('yellow', '○')} tests (not configured to run)`);
      }
    } else if (gate === 'lint') {
      console.log('  Running lint...');
      let result = spawnSync('npm', ['run', 'lint'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (result.status !== 0) {
        // Try auto-fix
        console.log(`  ${color('yellow', '⟳')} lint issues found, attempting auto-fix...`);
        const fixResult = spawnSync('npm', ['run', 'lint', '--', '--fix'], {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Re-run lint to check if issues are fixed
        result = spawnSync('npm', ['run', 'lint'], {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });

        if (result.status === 0) {
          console.log(`  ${color('green', '✓')} lint passed (auto-fixed)`);
        } else {
          console.log(`  ${color('red', '✗')} lint failed (manual fix required)`);
          const errorOutput = result.stderr || result.stdout || '';
          if (errorOutput) {
            console.log(color('dim', '  Remaining issues:'));
            const truncated = truncateOutput(errorOutput, 15, 800);
            truncated.split('\n').forEach(line => {
              console.log(color('dim', `    ${line}`));
            });
          }
          errors.lint = errorOutput;
          failed.push('lint');
        }
      } else {
        console.log(`  ${color('green', '✓')} lint passed`);
      }
    } else if (gate === 'typecheck') {
      console.log('  Running typecheck...');
      const result = spawnSync('npm', ['run', 'typecheck'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      if (result.status === 0) {
        console.log(`  ${color('green', '✓')} typecheck passed`);
      } else {
        console.log(`  ${color('red', '✗')} typecheck failed`);
        const errorOutput = result.stderr || result.stdout || '';
        if (errorOutput) {
          console.log(color('dim', '  Type errors:'));
          const truncated = truncateOutput(errorOutput, 20, 1000);
          truncated.split('\n').forEach(line => {
            console.log(color('dim', `    ${line}`));
          });
        }
        errors.typecheck = errorOutput;
        failed.push('typecheck');
      }
    } else if (gate === 'requestLogEntry') {
      // Check if request-log has an entry for this task
      try {
        const content = readFile(PATHS.requestLog, '');
        if (content.includes(taskId)) {
          console.log(`  ${color('green', '✓')} requestLogEntry (found in request-log)`);
        } else {
          console.log(`  ${color('yellow', '○')} requestLogEntry (add entry to request-log.md)`);
        }
      } catch (err) {
        if (process.env.DEBUG) console.error(`[DEBUG] requestLogEntry check: ${err.message}`);
        console.log(`  ${color('yellow', '○')} requestLogEntry (could not check)`);
      }
    } else if (gate === 'appMapUpdate') {
      console.log(`  ${color('yellow', '○')} appMapUpdate (verify manually if components created)`);
    } else {
      console.log(`  ${color('yellow', '○')} ${gate} (manual check)`);
    }
  }

  if (failed.length > 0) {
    console.log('');
    console.log(color('red', `Failed gates: ${failed.join(', ')}`));
  }

  return { passed: failed.length === 0, failed, errors };
}

/**
 * Commit changes if any
 */
function commitChanges(commitMsg) {
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (status.trim()) {
      console.log('');
      console.log(color('yellow', 'Committing changes...'));
      execSync('git add -A', { stdio: 'pipe' });
      // Use execFileSync to prevent command injection from user-provided commit message
      execFileSync('git', ['commit', '-m', `feat: ${commitMsg}`], { stdio: 'pipe' });
      success('Changes committed');
    }
  } catch (err) {
    // Log git errors but don't fail the task completion
    warn(`Git operation skipped: ${err.message || 'not a git repo or no changes'}`);
  }
}

async function main() {
  const taskId = process.argv[2];
  const commitMsg = process.argv[3] || `Complete ${taskId}`;

  if (!taskId) {
    console.log('Usage: flow done <task-id> [commit-message]');
    process.exit(1);
  }

  if (!fileExists(PATHS.ready)) {
    error('No ready.json found');
    process.exit(1);
  }

  // Run quality gates
  const gateResult = runQualityGates(taskId);

  if (!gateResult.passed) {
    // Create correction artifact for AI self-repair
    try {
      writeJson(LAST_FAILURE_PATH, {
        taskId,
        timestamp: new Date().toISOString(),
        failedGates: gateResult.failed,
        errors: gateResult.errors
      });
      console.log('');
      console.log(color('dim', `Failure details saved to: ${LAST_FAILURE_PATH}`));
    } catch (err) {
      if (process.env.DEBUG) console.error(`[DEBUG] Failed to save failure artifact: ${err.message}`);
    }

    console.log('');
    error('Quality gates failed. Fix issues before completing.');
    console.log(color('dim', 'Tip: Review the error output above or check .workflow/state/last-failure.json'));
    process.exit(1);
  }

  console.log('');

  // Check if task exists
  const found = findTask(taskId);

  if (!found) {
    console.log(color('red', `Task ${taskId} not found in any queue`));
    process.exit(1);
  }

  if (found.list !== 'inProgress') {
    console.log(color('red', `Task ${taskId} is in ${found.list}, not inProgress`));
    process.exit(1);
  }

  // Move task from inProgress to recentlyCompleted
  const result = moveTask(taskId, 'inProgress', 'recentlyCompleted');

  if (!result.success) {
    error(result.error);
    process.exit(1);
  }

  console.log(color('green', `✓ Completed: ${taskId}`));

  // v2.0: Archive durable session if one exists for this task
  try {
    const durableSession = loadDurableSession();
    if (durableSession && durableSession.taskId === taskId) {
      const archived = archiveDurableSession('completed');
      if (archived && process.env.DEBUG) {
        console.log(color('dim', `Archived durable session: ${archived.metrics.stepsCompleted} steps completed`));
      }
    }
  } catch (e) {
    if (process.env.DEBUG) console.error(`[DEBUG] Durable session archive: ${e.message}`);
  }

  // v1.7.0: Track task completion in session state and memory blocks
  try {
    trackTaskComplete(taskId);
    clearCurrentTask();

    // Add completion as a key fact
    const taskTitle = result.task?.title || taskId;
    addKeyFact(`Completed: ${taskTitle}`);
  } catch (e) {
    if (process.env.DEBUG) console.error(`[DEBUG] Task tracking: ${e.message}`);
  }

  // v1.7.0: Auto-archive request log if threshold exceeded
  try {
    const archiveResult = autoArchiveIfNeeded();
    if (archiveResult && archiveResult.archived > 0) {
      success(`Archived ${archiveResult.archived} request log entries`);
    }
  } catch (e) {
    if (process.env.DEBUG) console.error(`[DEBUG] Auto-archive: ${e.message}`);
  }

  // Commit if there are changes
  commitChanges(commitMsg);

  // v1.9.0: Run regression tests if configured
  const config = getConfig();
  if (config.regressionTesting?.enabled && config.regressionTesting?.runOnTaskComplete) {
    console.log('');
    try {
      const regressionResult = await runRegressionTests({ force: true });
      if (!regressionResult.success && config.regressionTesting?.onFailure === 'block') {
        warn('Regression tests failed - review before continuing');
        process.exit(1);
      } else if (!regressionResult.success) {
        warn('Regression tests failed - consider reviewing');
      }
    } catch (e) {
      if (process.env.DEBUG) console.error(`[DEBUG] Regression tests: ${e.message}`);
    }
  }

  // v1.9.0: Suggest browser tests for UI tasks
  if (config.browserTesting?.enabled && config.browserTesting?.runOnTaskComplete) {
    try {
      const browserSuggestion = suggestBrowserTests(taskId, result.task);
      if (browserSuggestion.suggested && browserSuggestion.flows.length > 0) {
        console.log('');
        console.log(color('cyan', '🌐 Browser tests available:'));
        browserSuggestion.flows.forEach(flow => {
          console.log(color('dim', `   - ${flow}`));
        });
        console.log(color('dim', `   Run: /wogi-test-browser ${browserSuggestion.flows[0]}`));
      }
    } catch (e) {
      if (process.env.DEBUG) console.error(`[DEBUG] Browser test suggestion: ${e.message}`);
    }
  }

  // v2.0: Refresh component index after task if configured
  const scanOn = config.componentIndex?.scanOn || [];
  if (config.componentIndex?.autoScan !== false && scanOn.includes('afterTask')) {
    try {
      console.log(color('dim', '🔄 Refreshing component index...'));
      execSync('bash scripts/flow-map-index scan --quiet', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      if (process.env.DEBUG) {
        console.log(color('dim', '   Component index updated'));
      }
    } catch (e) {
      if (process.env.DEBUG) console.error(`[DEBUG] Component index refresh: ${e.message}`);
    }
  }

  // v1.7.0: Check context health after task
  if (config.contextMonitor?.checkAfterTask !== false) {
    warnIfContextHigh();
  }
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
