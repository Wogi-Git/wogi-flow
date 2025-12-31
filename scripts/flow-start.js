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
  error
} = require('./flow-utils');

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
}

main();
