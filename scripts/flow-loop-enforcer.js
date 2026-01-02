#!/usr/bin/env node

/**
 * Wogi Flow - Loop Enforcer ("Ralph Wiggum Mode")
 *
 * Ensures self-completing loops actually complete. When enforced:true,
 * the loop cannot be exited until all acceptance criteria pass.
 *
 * "I'm helping!"
 */

const fs = require('fs');
const path = require('path');
const { getConfig, getProjectRoot } = require('./flow-utils');

/**
 * Check if loop enforcement is enabled
 */
function isEnforcementEnabled() {
  const config = getConfig();
  return config.loops?.enforced === true;
}

/**
 * Check if exit blocking is enabled
 */
function isExitBlocked() {
  const config = getConfig();
  return config.loops?.blockExitUntilComplete === true;
}

/**
 * Get active loop session
 */
function getActiveLoop() {
  const projectRoot = getProjectRoot();
  const sessionPath = path.join(projectRoot, '.workflow', 'state', 'loop-session.json');

  if (!fs.existsSync(sessionPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Start a new enforcement loop session
 */
function startLoop(taskId, acceptanceCriteria) {
  const projectRoot = getProjectRoot();
  const sessionPath = path.join(projectRoot, '.workflow', 'state', 'loop-session.json');

  const session = {
    taskId,
    startedAt: new Date().toISOString(),
    acceptanceCriteria: acceptanceCriteria.map((c, i) => ({
      id: `AC-${i + 1}`,
      description: c,
      status: 'pending',
      attempts: 0,
      lastAttempt: null,
      verificationResult: null
    })),
    iteration: 0,
    retries: 0,
    status: 'in_progress'
  };

  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  return session;
}

/**
 * Update criterion status in loop session
 */
function updateCriterion(criterionId, status, verificationResult = null) {
  const projectRoot = getProjectRoot();
  const sessionPath = path.join(projectRoot, '.workflow', 'state', 'loop-session.json');

  const session = getActiveLoop();
  if (!session) return null;

  const criterion = session.acceptanceCriteria.find(c => c.id === criterionId);
  if (criterion) {
    criterion.status = status;
    criterion.attempts++;
    criterion.lastAttempt = new Date().toISOString();
    criterion.verificationResult = verificationResult;
  }

  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  return session;
}

/**
 * Check if loop can exit (all criteria met or max retries reached)
 */
function canExitLoop() {
  const config = getConfig();
  const session = getActiveLoop();

  if (!session) return { canExit: true, reason: 'no-active-loop' };

  // Not enforced? Can always exit
  if (!isEnforcementEnabled()) {
    return { canExit: true, reason: 'enforcement-disabled' };
  }

  const pending = session.acceptanceCriteria.filter(c => c.status === 'pending');
  const failed = session.acceptanceCriteria.filter(c => c.status === 'failed');
  const completed = session.acceptanceCriteria.filter(c => c.status === 'completed');

  // All criteria completed?
  if (pending.length === 0 && failed.length === 0) {
    return {
      canExit: true,
      reason: 'all-complete',
      summary: `All ${completed.length} acceptance criteria passed`
    };
  }

  // Max retries exceeded?
  const maxRetries = config.loops?.maxRetries || 5;
  if (session.retries >= maxRetries) {
    return {
      canExit: true,
      reason: 'max-retries',
      summary: `Max retries (${maxRetries}) reached. ${failed.length} criteria still failing.`,
      failedCriteria: failed.map(f => f.description)
    };
  }

  // Max iterations exceeded?
  const maxIterations = config.loops?.maxIterations || 20;
  if (session.iteration >= maxIterations) {
    return {
      canExit: true,
      reason: 'max-iterations',
      summary: `Max iterations (${maxIterations}) reached.`,
      failedCriteria: failed.map(f => f.description)
    };
  }

  // Cannot exit - work to do
  return {
    canExit: false,
    reason: 'incomplete',
    pending: pending.length,
    failed: failed.length,
    completed: completed.length,
    message: generateEnforcementMessage(session, pending, failed)
  };
}

/**
 * Generate the Ralph Wiggum enforcement message
 */
function generateEnforcementMessage(session, pending, failed) {
  const lines = [
    '🚫 LOOP ENFORCEMENT ACTIVE',
    '─'.repeat(40),
    '',
    `Task: ${session.taskId}`,
    `Iteration: ${session.iteration}`,
    `Retries: ${session.retries}`,
    ''
  ];

  if (pending.length > 0) {
    lines.push(`⏳ Pending (${pending.length}):`);
    pending.forEach(p => lines.push(`   • ${p.description}`));
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push(`❌ Failed (${failed.length}):`);
    failed.forEach(f => {
      lines.push(`   • ${f.description}`);
      if (f.verificationResult) {
        lines.push(`     └─ ${f.verificationResult}`);
      }
    });
    lines.push('');
  }

  lines.push('─'.repeat(40));
  lines.push('🔄 You must complete all criteria before exiting.');
  lines.push('   (Ralph Wiggum says: "I\'m helping!")');

  return lines.join('\n');
}

/**
 * Increment loop iteration
 */
function incrementIteration() {
  const projectRoot = getProjectRoot();
  const sessionPath = path.join(projectRoot, '.workflow', 'state', 'loop-session.json');

  const session = getActiveLoop();
  if (!session) return null;

  session.iteration++;
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  return session;
}

/**
 * Increment retry count
 */
function incrementRetry() {
  const projectRoot = getProjectRoot();
  const sessionPath = path.join(projectRoot, '.workflow', 'state', 'loop-session.json');

  const session = getActiveLoop();
  if (!session) return null;

  session.retries++;
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  return session;
}

/**
 * End the loop session
 */
function endLoop(status = 'completed') {
  const projectRoot = getProjectRoot();
  const sessionPath = path.join(projectRoot, '.workflow', 'state', 'loop-session.json');

  const session = getActiveLoop();
  if (!session) return null;

  session.status = status;
  session.endedAt = new Date().toISOString();

  // Archive to history
  const historyPath = path.join(projectRoot, '.workflow', 'state', 'loop-history.json');
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch {
      history = [];
    }
  }
  history.push(session);

  // Keep last 50 sessions
  if (history.length > 50) {
    history = history.slice(-50);
  }

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

  // Remove active session
  fs.unlinkSync(sessionPath);

  return session;
}

/**
 * Get loop statistics
 */
function getLoopStats() {
  const projectRoot = getProjectRoot();
  const historyPath = path.join(projectRoot, '.workflow', 'state', 'loop-history.json');

  if (!fs.existsSync(historyPath)) {
    return { totalLoops: 0, completed: 0, failed: 0, avgIterations: 0 };
  }

  try {
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    const completed = history.filter(h => h.status === 'completed').length;
    const failed = history.filter(h => h.status === 'failed').length;
    const avgIterations = history.length > 0
      ? history.reduce((sum, h) => sum + h.iteration, 0) / history.length
      : 0;

    return {
      totalLoops: history.length,
      completed,
      failed,
      avgIterations: Math.round(avgIterations * 10) / 10
    };
  } catch {
    return { totalLoops: 0, completed: 0, failed: 0, avgIterations: 0 };
  }
}

/**
 * Verify a specific criterion
 * Returns { passed: boolean, message: string }
 */
function verifyCriterion(criterion, context = {}) {
  // This is a placeholder - actual verification happens in orchestrate
  // But we can check for common patterns

  const { changedFiles = [], testResults = null, lintResults = null } = context;

  // Check for "file exists" criteria
  const fileExistsMatch = criterion.description.match(/create\s+(?:a\s+)?file\s+["`']?([^"`'\s]+)["`']?/i);
  if (fileExistsMatch) {
    const expectedFile = fileExistsMatch[1];
    const found = changedFiles.some(f => f.includes(expectedFile));
    return {
      passed: found,
      message: found ? `File ${expectedFile} created` : `File ${expectedFile} not found`
    };
  }

  // Check for "tests pass" criteria
  if (criterion.description.toLowerCase().includes('test') &&
      criterion.description.toLowerCase().includes('pass')) {
    if (testResults) {
      return {
        passed: testResults.failed === 0,
        message: testResults.failed === 0
          ? 'All tests pass'
          : `${testResults.failed} tests failing`
      };
    }
  }

  // Check for "lint passes" criteria
  if (criterion.description.toLowerCase().includes('lint')) {
    if (lintResults) {
      return {
        passed: lintResults.errors === 0,
        message: lintResults.errors === 0
          ? 'No lint errors'
          : `${lintResults.errors} lint errors`
      };
    }
  }

  // Cannot auto-verify - needs manual check
  return {
    passed: null,
    message: 'Requires manual verification'
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  isEnforcementEnabled,
  isExitBlocked,
  getActiveLoop,
  startLoop,
  updateCriterion,
  canExitLoop,
  incrementIteration,
  incrementRetry,
  endLoop,
  getLoopStats,
  verifyCriterion,
  generateEnforcementMessage
};

// ============================================================
// CLI
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status': {
      const session = getActiveLoop();
      if (!session) {
        console.log('No active loop session');
        break;
      }

      console.log('\n📊 Active Loop Session\n');
      console.log(`Task: ${session.taskId}`);
      console.log(`Started: ${session.startedAt}`);
      console.log(`Iteration: ${session.iteration}`);
      console.log(`Retries: ${session.retries}`);
      console.log('\nAcceptance Criteria:');
      session.acceptanceCriteria.forEach(c => {
        const icon = c.status === 'completed' ? '✅' : c.status === 'failed' ? '❌' : '⏳';
        console.log(`  ${icon} ${c.id}: ${c.description}`);
        if (c.verificationResult) {
          console.log(`     └─ ${c.verificationResult}`);
        }
      });

      const exit = canExitLoop();
      console.log(`\nCan exit: ${exit.canExit ? 'Yes' : 'No'} (${exit.reason})`);
      break;
    }

    case 'stats': {
      const stats = getLoopStats();
      console.log('\n📈 Loop Statistics\n');
      console.log(`Total loops: ${stats.totalLoops}`);
      console.log(`Completed: ${stats.completed}`);
      console.log(`Failed: ${stats.failed}`);
      console.log(`Avg iterations: ${stats.avgIterations}`);
      break;
    }

    case 'can-exit': {
      const result = canExitLoop();
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.canExit ? 0 : 1);
      break;
    }

    default:
      console.log(`
Wogi Flow - Loop Enforcer

Usage:
  node flow-loop-enforcer.js <command>

Commands:
  status      Show active loop session
  stats       Show loop statistics
  can-exit    Check if loop can be exited (exit code 0=yes, 1=no)

Configuration (config.json):
  loops.enforced: true              Enable Ralph Wiggum mode
  loops.blockExitUntilComplete: true  Block session end until complete
  loops.maxRetries: 5               Max retries before forced exit
  loops.maxIterations: 20           Max iterations before forced exit
`);
  }
}
