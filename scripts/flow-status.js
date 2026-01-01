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

  console.log('');
  console.log(color('cyan', '═'.repeat(50)));
}

if (require.main === module) {
  main();
}
