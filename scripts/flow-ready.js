#!/usr/bin/env node

/**
 * Wogi Flow - Show Ready Tasks
 *
 * Displays tasks organized by status from ready.json
 */

const {
  PATHS,
  fileExists,
  getReadyData,
  color,
  printSection,
  error
} = require('./flow-utils');

function main() {
  if (!fileExists(PATHS.ready)) {
    error('No ready.json found');
    console.log('Run: ./scripts/flow init');
    process.exit(1);
  }

  printSection('Task Queue');
  console.log('===========');
  console.log('');

  const data = getReadyData();

  // Ready tasks
  const ready = data.ready || [];
  if (ready.length > 0) {
    console.log(color('green', '✓ READY'));
    for (const task of ready) {
      if (typeof task === 'object') {
        const priority = task.priority || '-';
        console.log(`  [${priority}] ${task.id || '?'}: ${task.title || 'No title'}`);
      } else {
        console.log(`  • ${task}`);
      }
    }
    console.log('');
  }

  // In progress
  const inProgress = data.inProgress || [];
  if (inProgress.length > 0) {
    console.log(color('yellow', '⏳ IN PROGRESS'));
    for (const task of inProgress) {
      if (typeof task === 'object') {
        console.log(`  • ${task.id || '?'}: ${task.title || 'No title'}`);
      } else {
        console.log(`  • ${task}`);
      }
    }
    console.log('');
  }

  // Blocked
  const blocked = data.blocked || [];
  if (blocked.length > 0) {
    console.log(color('red', '🚫 BLOCKED'));
    for (const task of blocked) {
      if (typeof task === 'object') {
        const reason = task.reason || 'Unknown';
        console.log(`  • ${task.id || '?'}: ${reason}`);
      } else {
        console.log(`  • ${task}`);
      }
    }
    console.log('');
  }

  // Recently completed
  const completed = data.recentlyCompleted || [];
  if (completed.length > 0) {
    console.log(color('cyan', '✅ RECENTLY COMPLETED'));
    for (const task of completed.slice(0, 5)) {
      if (typeof task === 'object') {
        console.log(`  • ${task.id || '?'}: ${task.title || 'No title'}`);
      } else {
        console.log(`  • ${task}`);
      }
    }
    console.log('');
  }

  // Summary
  const total = ready.length + inProgress.length + blocked.length;
  console.log(`Total active: ${total} (${ready.length} ready, ${inProgress.length} in progress, ${blocked.length} blocked)`);
}

if (require.main === module) {
  main();
}
