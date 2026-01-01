#!/usr/bin/env node

/**
 * Wogi Flow - Complete Task
 *
 * Runs quality gates and moves task from inProgress to completed.
 */

const { execSync, execFileSync, spawnSync } = require('child_process');
const {
  PATHS,
  fileExists,
  getConfig,
  moveTask,
  findTask,
  readFile,
  color,
  success,
  warn,
  error
} = require('./flow-utils');

/**
 * Run quality gates from config
 */
function runQualityGates(taskId) {
  if (!fileExists(PATHS.config)) {
    return { passed: true, failed: [] };
  }

  console.log(color('yellow', 'Running quality gates...'));
  console.log('');

  const config = getConfig();
  const gates = config.qualityGates?.feature?.require || [];
  const testing = config.testing || {};
  const failed = [];

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
          failed.push('tests');
        }
      } else {
        console.log(`  ${color('yellow', '○')} tests (not configured to run)`);
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

  return { passed: failed.length === 0, failed };
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

function main() {
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
    console.log('');
    error('Quality gates failed. Fix issues before completing.');
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

  // Commit if there are changes
  commitChanges(commitMsg);
}

main();
