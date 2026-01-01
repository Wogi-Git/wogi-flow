#!/usr/bin/env node

/**
 * Wogi Flow - Start Task
 *
 * Moves a task from ready to inProgress queue.
 */

const {
  PATHS,
  fileExists,
  moveTask,
  findTask,
  color,
  error,
  getConfig
} = require('./flow-utils');
const { getAutoContext, formatAutoContext } = require('./flow-auto-context');
const { shouldUseMultiApproach, analyzeForMultiApproach, formatAnalysis } = require('./flow-multi-approach');
const { assessTaskComplexity } = require('./flow-complexity');

function main() {
  const taskId = process.argv[2];

  if (!taskId) {
    console.log('Usage: flow start <task-id>');
    process.exit(1);
  }

  if (!fileExists(PATHS.ready)) {
    error('No ready.json found');
    process.exit(1);
  }

  // Check if task exists and where it is
  const found = findTask(taskId);

  if (!found) {
    console.log(color('red', `Task ${taskId} not found in any queue`));
    process.exit(1);
  }

  if (found.list === 'inProgress') {
    console.log(color('yellow', `Task ${taskId} is already in progress`));
    process.exit(0);
  }

  if (found.list !== 'ready') {
    console.log(color('red', `Task ${taskId} is in ${found.list}, not ready`));
    process.exit(1);
  }

  // Move task from ready to inProgress
  const result = moveTask(taskId, 'ready', 'inProgress');

  if (!result.success) {
    error(result.error);
    process.exit(1);
  }

  console.log(color('green', `✓ Started: ${taskId}`));

  if (result.task && typeof result.task === 'object' && result.task.title) {
    console.log(`  ${result.task.title}`);
  }

  // Auto-context: show relevant files for this task
  const config = getConfig();
  const taskDescription = result.task?.title || result.task?.description || taskId;

  if (config.autoContext?.enabled !== false) {
    const context = getAutoContext(taskDescription);
    if (context.files && context.files.length > 0) {
      console.log('');
      console.log(formatAutoContext(context));
    }
  }

  // Multi-approach: suggest for complex tasks
  if (config.multiApproach?.enabled !== false && config.multiApproach?.mode === 'suggest') {
    try {
      const complexity = assessTaskComplexity(taskDescription);
      const decision = shouldUseMultiApproach(complexity.level);

      if (decision.shouldUse) {
        console.log('');
        console.log(color('yellow', '━'.repeat(50)));
        console.log(color('yellow', '💡 Multi-Approach Suggestion'));
        console.log(color('yellow', '━'.repeat(50)));
        console.log(`This task has "${complexity.level}" complexity.`);
        console.log('Consider using multi-approach validation for better results.');
        console.log(`  Run: ${color('cyan', `flow multi-approach --analyze "${taskDescription}"`)}`);
        console.log('');
      }
    } catch {
      // Ignore multi-approach errors
    }
  }
}

main();
