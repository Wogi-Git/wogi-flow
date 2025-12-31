#!/usr/bin/env node

/**
 * Wogi Flow - End Session Properly
 *
 * Ensures all workflow state is saved, optionally commits and pushes.
 */

const { execSync, spawnSync } = require('child_process');
const readline = require('readline');
const path = require('path');
const {
  PATHS,
  PROJECT_ROOT,
  fileExists,
  getConfig,
  getConfigValue,
  readFile,
  writeFile,
  isGitRepo,
  getGitStatus,
  color,
  printSection,
  success,
  warn
} = require('./flow-utils');

/**
 * Prompt user for input
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Check session-end requirements from config
 */
function checkRequirements() {
  if (!fileExists(PATHS.config)) return;

  console.log(color('yellow', 'Checking session-end requirements...'));

  const config = getConfig();
  const steps = config.mandatorySteps?.onSessionEnd || [];

  if (steps.length > 0) {
    console.log('Required:');
    for (const step of steps) {
      console.log(`  • ${step}`);
    }
  }

  console.log('');
}

/**
 * Handle uncommitted changes
 */
async function handleUncommittedChanges() {
  const git = getGitStatus();

  if (!git.isRepo) return;

  if (git.uncommitted > 0) {
    console.log(color('yellow', `Uncommitted changes: ${git.uncommitted} files`));

    try {
      const status = execSync('git status --short', { encoding: 'utf-8' });
      console.log(status);
    } catch {
      // Ignore
    }

    const confirm = await prompt('Commit all changes? (y/N) ');

    if (confirm.toLowerCase() === 'y') {
      const msg = await prompt('Commit message: ');
      const commitMsg = msg || 'checkpoint: end of session';

      try {
        execSync('git add -A', { stdio: 'pipe' });
        execSync(`git commit -m "${commitMsg}"`, { stdio: 'pipe' });
        success('Changes committed');
      } catch (e) {
        warn(`Commit failed: ${e.message}`);
      }
    }
  } else {
    success('No uncommitted changes');
  }

  console.log('');
}

/**
 * Update progress.md timestamp
 */
function updateProgress() {
  if (!fileExists(PATHS.progress)) return;

  console.log(color('yellow', 'Updating progress.md...'));

  try {
    let content = readFile(PATHS.progress);
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Update or add timestamp
    if (content.includes('## Last Updated')) {
      content = content.replace(/## Last Updated.*(\n|$)/, `## Last Updated\n${timestamp}\n`);
    } else {
      content = `## Last Updated\n${timestamp}\n\n${content}`;
    }

    writeFile(PATHS.progress, content);
    success('Progress updated');
  } catch (e) {
    warn(`Failed to update progress: ${e.message}`);
  }
}

/**
 * Extract skill learnings if configured
 */
function extractSkillLearnings() {
  if (!fileExists(PATHS.config)) return;

  const skillLearning = getConfigValue('skillLearning', {});

  if (skillLearning.enabled && skillLearning.autoExtract) {
    console.log('');
    console.log(color('yellow', 'Extracting skill learnings...'));

    const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'flow-skill-learn.js');
    if (fileExists(scriptPath)) {
      const result = spawnSync('node', [scriptPath, '--trigger=session-end'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (result.status === 0) {
        success('Skills updated');
      }
    }
  }
}

/**
 * Offer to push to remote
 */
async function offerPush() {
  if (!isGitRepo()) return;

  try {
    execSync('git remote get-url origin', { stdio: 'pipe' });

    const confirm = await prompt('Push to remote? (y/N) ');

    if (confirm.toLowerCase() === 'y') {
      execSync('git push', { stdio: 'inherit' });
      success('Pushed to remote');
    }
  } catch {
    // No remote configured, skip
  }
}

/**
 * Show status summary
 */
function showSummary() {
  console.log('');
  console.log(color('green', 'Session ended cleanly.'));
  console.log('');
  console.log('Summary:');

  const statusScript = path.join(PROJECT_ROOT, 'scripts', 'flow-status.js');
  if (fileExists(statusScript)) {
    try {
      spawnSync('node', [statusScript], {
        encoding: 'utf-8',
        stdio: 'inherit'
      });
    } catch {
      console.log("  (run 'flow status' for details)");
    }
  } else {
    console.log("  (run 'flow status' for details)");
  }
}

async function main() {
  printSection('Ending Session');
  console.log('===============');
  console.log('');

  // Check requirements
  checkRequirements();

  // Handle uncommitted changes
  await handleUncommittedChanges();

  // Update progress
  updateProgress();

  // Extract skill learnings
  extractSkillLearnings();

  console.log('');

  // Offer to push
  await offerPush();

  // Show summary
  showSummary();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
