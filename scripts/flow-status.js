#!/usr/bin/env node

/**
 * Wogi Flow - Project Status Overview
 *
 * Shows task counts, features, bugs, components, and config summary.
 */

const {
  PATHS,
  fileExists,
  dirExists,
  getTaskCounts,
  getConfig,
  getReadyData,
  countRequestLogEntries,
  countAppMapComponents,
  getGitStatus,
  listDirs,
  listFiles,
  printHeader,
  printSection,
  color
} = require('./flow-utils');

function main() {
  printHeader('PROJECT STATUS');

  // Task counts
  if (fileExists(PATHS.ready)) {
    printSection('Tasks');
    const counts = getTaskCounts();
    console.log(`  Ready: ${counts.ready}`);
    console.log(`  In Progress: ${counts.inProgress}`);
    console.log(`  Blocked: ${counts.blocked}`);
    console.log(`  Recently Done: ${counts.recentlyCompleted}`);
    console.log('');
  }

  // Features
  if (dirExists(PATHS.changes)) {
    const features = listDirs(PATHS.changes);
    printSection('Features');
    console.log(`  Active: ${features.length}`);
    if (features.length > 0) {
      for (const feature of features) {
        console.log(`    • ${feature}`);
      }
    }
    console.log('');
  }

  // Bugs
  if (dirExists(PATHS.bugs)) {
    const bugs = listFiles(PATHS.bugs, '.md');
    printSection('Bugs');
    console.log(`  Open: ${bugs.length}`);
    console.log('');
  }

  // Components
  if (fileExists(PATHS.appMap)) {
    const componentCount = countAppMapComponents();
    printSection('Components');
    console.log(`  Mapped: ${componentCount}`);
    console.log('');
  }

  // Request log
  if (fileExists(PATHS.requestLog)) {
    const entryCount = countRequestLogEntries();
    printSection('Request Log');
    console.log(`  Entries: ${entryCount}`);
    console.log('');
  }

  // Git status
  const git = getGitStatus();
  if (git.isRepo) {
    printSection('Git');
    console.log(`  Branch: ${git.branch || 'unknown'}`);
    console.log(`  Uncommitted: ${git.uncommitted || 0} files`);
    console.log('');
  }

  // Config summary
  if (fileExists(PATHS.config)) {
    printSection('Config');
    const config = getConfig();
    const steps = config.mandatorySteps || {};
    const afterTask = steps.afterTask || [];

    if (afterTask.length > 0) {
      console.log(`  After task: ${afterTask.join(', ')}`);
    } else {
      console.log('  After task: (none)');
    }
  }

  // Action-oriented recommendation
  printSection('📌 Recommended Next Action');
  const recommendation = getRecommendation();
  console.log(`  ${recommendation.action}`);
  if (recommendation.command) {
    console.log(color('dim', `  Run: ${recommendation.command}`));
  }

  console.log('');
  console.log(color('cyan', '═'.repeat(50)));
}

/**
 * Get recommended next action based on current state
 */
function getRecommendation() {
  const config = getConfig();

  // Check for uncommitted changes first
  const git = getGitStatus();
  if (git.isRepo && git.uncommitted > 0) {
    return {
      action: `Commit ${git.uncommitted} uncommitted file(s)`,
      command: 'git add -A && git commit -m "message"'
    };
  }

  // Check task state
  if (!fileExists(PATHS.ready)) {
    return {
      action: 'Initialize workflow to start tracking tasks',
      command: 'flow install'
    };
  }

  const data = getReadyData();

  // Check in-progress tasks first
  const inProgress = data.inProgress || [];
  if (inProgress.length > 0) {
    const task = inProgress[0];
    const taskId = typeof task === 'string' ? task : task.id;
    const taskTitle = typeof task === 'object' ? (task.title || task.description || '') : '';
    return {
      action: `Continue working on ${taskId}${taskTitle ? `: ${taskTitle.slice(0, 40)}` : ''}`,
      command: null
    };
  }

  // Check ready tasks
  const ready = data.ready || [];
  if (ready.length > 0) {
    // Find highest priority task
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...ready].sort((a, b) => {
      const aPriority = priorityOrder[a.priority] ?? 2;
      const bPriority = priorityOrder[b.priority] ?? 2;
      return aPriority - bPriority;
    });

    const task = sorted[0];
    const taskId = typeof task === 'string' ? task : task.id;
    const taskTitle = typeof task === 'object' ? (task.title || task.description || '') : '';
    const priority = typeof task === 'object' && task.priority ? ` [${task.priority}]` : '';
    return {
      action: `Start ${taskId}${priority}${taskTitle ? `: ${taskTitle.slice(0, 35)}` : ''}`,
      command: `flow start ${taskId}`
    };
  }

  // Check blocked tasks
  const blocked = data.blocked || [];
  if (blocked.length > 0) {
    return {
      action: `${blocked.length} task(s) are blocked - resolve dependencies`,
      command: 'flow ready'
    };
  }

  // No tasks at all
  return {
    action: 'Create a new task to work on',
    command: 'flow story "Your task title"'
  };
}

if (require.main === module) {
  main();
}
