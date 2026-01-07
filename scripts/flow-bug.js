#!/usr/bin/env node

/**
 * Wogi Flow - Create Bug Report
 *
 * Creates a bug report with hash-based ID and discovered-from tracking.
 *
 * Usage:
 *   node scripts/flow-bug.js "<title>" [--from wf-XXXXXXXX] [--priority P0-P4] [--json]
 *
 * Options:
 *   --from       Task ID that discovered this bug (auto-detected if omitted)
 *   --priority   Priority level P0-P4 (default: P1 if discovered during task, else P2)
 *   --severity   Severity: critical, high, medium, low (default: medium)
 *   --json       Output JSON instead of human-readable
 */

const fs = require('fs');
const path = require('path');
const {
  PATHS,
  fileExists,
  dirExists,
  writeFile,
  generateTaskId,
  parseFlags,
  outputJson,
  getConfig,
  getConfigValue,
  color,
  success,
  warn,
  info,
  error
} = require('./flow-utils');

// Try to load session state for auto-detecting current task
let loadSessionState;
try {
  const sessionModule = require('./flow-session-state');
  loadSessionState = sessionModule.loadSessionState;
} catch (importError) {
  // Log in debug mode - don't silently hide potential syntax errors
  if (process.env.DEBUG) {
    console.warn(`[DEBUG] Could not load flow-session-state: ${importError.message}`);
  }
  loadSessionState = () => ({});
}

/**
 * Get current task from session state (for auto-populating discovered-from)
 */
function getCurrentTask() {
  try {
    const sessionState = loadSessionState();
    return sessionState.currentTask || null;
  } catch {
    return null;
  }
}

/**
 * Create bug report content
 */
function createBugContent(bug) {
  const {
    id,
    title,
    severity,
    priority,
    discoveredFrom,
    discoveredDuring,
    createdAt
  } = bug;

  const date = createdAt.split('T')[0];
  const discoveredSection = discoveredFrom
    ? `**Discovered From**: ${discoveredFrom}\n**Discovered During**: ${discoveredDuring}\n`
    : '';

  return `# ${id}: ${title}

**Created**: ${date}
**Status**: Open
**Severity**: ${severity.charAt(0).toUpperCase() + severity.slice(1)}
**Priority**: ${priority}
**Tags**: #bug
${discoveredSection}
## Description
[Clear description of the bug]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Browser:
- OS:
- Version:

## Screenshots
[If applicable]

## Possible Fix
[If you have ideas about what's causing it or how to fix]

## Related
- [Related request-log entries]
- [Related components from app-map]
${discoveredFrom ? `- Discovered while working on: ${discoveredFrom}` : ''}

## Resolution
[Fill in when fixed]
- Fixed in: [commit/PR]
- Root cause: [explanation]
`;
}

/**
 * Main function
 */
function main() {
  const { flags, positional } = parseFlags(process.argv.slice(2));

  // Handle help
  if (flags.help) {
    console.log(`
Usage: flow bug "<title>" [options]

Create a bug report with automatic tracking.

Options:
  --from <id>      Task ID that discovered this bug
  --priority <P>   Priority P0-P4 (default: P1 if during task, else P2)
  --severity <s>   Severity: critical, high, medium, low (default: medium)
  --json           Output JSON

Examples:
  flow bug "Login button not responding"
  flow bug "Null pointer in Profile API" --from wf-a1b2c3d4 --priority P0
  flow bug "Fix auth header" --severity critical
`);
    process.exit(0);
  }

  // Validate title
  const title = positional[0];
  if (!title) {
    error('Title is required');
    console.log('Usage: flow bug "<title>" [--from <task-id>] [--priority P0-P4]');
    process.exit(1);
  }

  // Ensure bugs directory exists
  if (!dirExists(PATHS.bugs)) {
    fs.mkdirSync(PATHS.bugs, { recursive: true });
  }

  // Get current task for auto-detection
  const currentTask = getCurrentTask();

  // Determine discovered-from (explicit flag or auto-detect)
  const discoveredFrom = flags.from || (currentTask ? currentTask.id : null);
  const discoveredDuring = currentTask ? 'implementation' : null;

  // Determine priority
  const config = getConfig();
  const defaultPriority = getConfigValue('priorities.defaultPriority', 'P2');

  let priority = flags.priority;
  if (!priority) {
    // Bugs discovered during task work get higher priority
    priority = discoveredFrom ? 'P1' : defaultPriority;
  }

  // Validate priority format
  if (!/^P[0-4]$/.test(priority)) {
    warn(`Invalid priority "${priority}", using ${defaultPriority}`);
    priority = defaultPriority;
  }

  // Determine severity
  const validSeverities = ['critical', 'high', 'medium', 'low'];
  let severity = (flags.severity || 'medium').toLowerCase();
  if (!validSeverities.includes(severity)) {
    warn(`Invalid severity "${severity}", using medium`);
    severity = 'medium';
  }

  // Generate bug ID
  const id = generateTaskId(title);
  const createdAt = new Date().toISOString();

  // Create bug object
  const bug = {
    id,
    title,
    severity,
    priority,
    discoveredFrom,
    discoveredDuring,
    status: 'Open',
    createdAt
  };

  // Write bug file
  const bugPath = path.join(PATHS.bugs, `${id}.md`);
  const content = createBugContent(bug);
  writeFile(bugPath, content);

  // Output result
  if (flags.json) {
    outputJson({
      success: true,
      bug,
      file: bugPath
    });
  } else {
    console.log('');
    success(`Created: ${id}`);
    console.log(`  ${color('cyan', bugPath)}`);
    console.log('');
    console.log(`Title: ${title}`);
    console.log(`Priority: ${priority} | Severity: ${severity}`);

    if (discoveredFrom) {
      console.log(`Discovered from: ${color('yellow', discoveredFrom)}`);
    }

    console.log('');
    info('Edit the file to add description, steps to reproduce, etc.');
  }
}

// Run only when executed directly
if (require.main === module) {
  main();
}

module.exports = { main, createBugContent, getCurrentTask };
