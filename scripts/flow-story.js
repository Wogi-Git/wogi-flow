#!/usr/bin/env node

/**
 * Wogi Flow - Story Creation with Deep Decomposition
 *
 * Creates detailed stories with acceptance criteria.
 * Supports --deep flag for automatic decomposition into sub-tasks.
 *
 * Usage:
 *   flow story "Add login form"              # Create standard story
 *   flow story "Add login form" --deep       # Create with decomposition
 *   flow story "Add login form" auth-feature # Specify feature folder
 */

const fs = require('fs');
const path = require('path');
const { getProjectRoot, colors, getConfig } = require('./flow-utils');

const PROJECT_ROOT = getProjectRoot();
const WORKFLOW_DIR = path.join(PROJECT_ROOT, '.workflow');
const CHANGES_DIR = path.join(WORKFLOW_DIR, 'changes');
const STATE_DIR = path.join(WORKFLOW_DIR, 'state');
const READY_PATH = path.join(STATE_DIR, 'ready.json');

function log(color, ...args) {
  console.log(colors[color] + args.join(' ') + colors.reset);
}

/**
 * Get next task number from a feature directory
 */
function getNextTaskNumber(featureDir) {
  const tasksFile = path.join(featureDir, 'tasks.json');

  if (fs.existsSync(tasksFile)) {
    try {
      const content = fs.readFileSync(tasksFile, 'utf8');
      const matches = content.match(/"id":\s*"TASK-(\d+)"/g) || [];
      const numbers = matches.map(m => parseInt(m.match(/\d+/)[0], 10));
      return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    } catch (e) {
      return 1;
    }
  }

  // Also check ready.json for existing task numbers
  if (fs.existsSync(READY_PATH)) {
    try {
      const ready = JSON.parse(fs.readFileSync(READY_PATH, 'utf8'));
      const allTasks = [
        ...(ready.ready || []),
        ...(ready.inProgress || []),
        ...(ready.recentlyCompleted || []),
        ...(ready.blocked || [])
      ];
      const numbers = allTasks
        .map(t => t.id?.match(/TASK-(\d+)/))
        .filter(Boolean)
        .map(m => parseInt(m[1], 10));
      return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    } catch (e) {
      return 1;
    }
  }

  return 1;
}

/**
 * Generate story template content
 */
function generateStoryTemplate(taskId, title) {
  return `# [${taskId}] ${title}

## User Story
**As a** [user type]
**I want** [action/capability]
**So that** [benefit/value]

## Description
[2-4 sentences explaining the context, what needs to be built, and why it matters.]

## Acceptance Criteria

### Scenario 1: Happy path
**Given** [initial context/state]
**When** [action taken]
**Then** [expected outcome]
**And** [additional outcome if needed]

### Scenario 2: Alternative path
**Given** [context]
**When** [action]
**Then** [outcome]

### Scenario 3: Error handling
**Given** [context]
**When** [invalid action or error condition]
**Then** [error handling behavior]

## Technical Notes
- **Components**:
  - Use existing: [check app-map.md]
  - Create new: [add to app-map after]
- **API**: [endpoints if any]
- **State**: [state management notes]
- **Constraints**: [technical limitations]

## Test Strategy
- [ ] Unit: [what to test]
- [ ] Integration: [what to test]
- [ ] E2E: [user flow to verify]

## Dependencies
- None

## Complexity
[Low / Medium / High] - [justification]

## Out of Scope
- [What this does NOT include]
`;
}

/**
 * Generate sub-task template
 */
function generateSubTaskTemplate(parentId, subNum, objective, doneCriteria, deps = []) {
  const subTaskId = `${parentId}-${String(subNum).padStart(2, '0')}`;
  const depStr = deps.length > 0
    ? deps.map(d => `- ${d}`).join('\n')
    : '- None (can start immediately)';

  return {
    id: subTaskId,
    content: `# [${subTaskId}] ${objective}

## Objective
${objective}

## Done Criteria
${doneCriteria.map(c => `- [ ] ${c}`).join('\n')}

## Dependencies
${depStr}

## Scope
S - Single focused objective

## Parent
Part of [${parentId}]
`
  };
}

/**
 * Analyze title and suggest decomposition
 */
function analyzeForDecomposition(title) {
  const titleLower = title.toLowerCase();

  // Common patterns that suggest complexity
  const complexityIndicators = {
    auth: ['login', 'logout', 'register', 'signup', 'authentication', 'password', 'session'],
    form: ['form', 'input', 'validation', 'submit'],
    crud: ['create', 'read', 'update', 'delete', 'edit', 'list', 'view'],
    ui: ['component', 'modal', 'dialog', 'dropdown', 'table', 'grid', 'card'],
    api: ['api', 'endpoint', 'fetch', 'request', 'integration'],
    state: ['state', 'store', 'context', 'redux', 'zustand']
  };

  const detectedPatterns = [];
  for (const [pattern, keywords] of Object.entries(complexityIndicators)) {
    if (keywords.some(kw => titleLower.includes(kw))) {
      detectedPatterns.push(pattern);
    }
  }

  // Suggest sub-tasks based on patterns
  const suggestedSubTasks = [];

  if (detectedPatterns.includes('auth')) {
    suggestedSubTasks.push(
      { objective: 'Create UI layout and structure', criteria: ['Layout renders correctly', 'Responsive design works'] },
      { objective: 'Add form inputs with validation', criteria: ['Inputs accept user data', 'Validation feedback shows'] },
      { objective: 'Implement API integration', criteria: ['API calls work', 'Errors handled'] },
      { objective: 'Handle success flow', criteria: ['Success redirects work', 'State updates correctly'] },
      { objective: 'Handle error states', criteria: ['Error messages display', 'User can retry'] },
      { objective: 'Add loading states', criteria: ['Loading indicator shows', 'UI disabled during load'] }
    );
  } else if (detectedPatterns.includes('form')) {
    suggestedSubTasks.push(
      { objective: 'Create form layout', criteria: ['Form renders correctly', 'Labels and inputs aligned'] },
      { objective: 'Add input validation', criteria: ['Validation rules work', 'Error messages show'] },
      { objective: 'Implement form submission', criteria: ['Submit triggers correctly', 'Data sent properly'] },
      { objective: 'Handle submission states', criteria: ['Loading state works', 'Success/error handled'] }
    );
  } else if (detectedPatterns.includes('crud')) {
    suggestedSubTasks.push(
      { objective: 'Create list/display view', criteria: ['Data displays correctly', 'Empty state handled'] },
      { objective: 'Add create functionality', criteria: ['Create form works', 'New items appear'] },
      { objective: 'Add edit functionality', criteria: ['Edit form populates', 'Changes save correctly'] },
      { objective: 'Add delete functionality', criteria: ['Delete confirmation works', 'Items removed correctly'] }
    );
  } else if (detectedPatterns.includes('ui')) {
    suggestedSubTasks.push(
      { objective: 'Create component structure', criteria: ['Component renders', 'Props typed correctly'] },
      { objective: 'Add styling and variants', criteria: ['Styles applied', 'Variants work'] },
      { objective: 'Add interactivity', criteria: ['Events handled', 'State updates'] },
      { objective: 'Handle edge cases', criteria: ['Empty state works', 'Error state works', 'Loading state works'] }
    );
  }

  return {
    patterns: detectedPatterns,
    suggestedSubTasks,
    shouldDecompose: suggestedSubTasks.length >= 3
  };
}

/**
 * Create story with optional deep decomposition
 */
function createStory(title, feature, options = {}) {
  const config = getConfig();
  const decompositionConfig = config.storyDecomposition || {};

  // Ensure directories exist
  const featureDir = path.join(CHANGES_DIR, feature);
  fs.mkdirSync(featureDir, { recursive: true });

  // Get next task ID
  const nextNum = getNextTaskNumber(featureDir);
  const taskId = `TASK-${String(nextNum).padStart(3, '0')}`;

  // Create main story file
  const storyContent = generateStoryTemplate(taskId, title);
  const storyFile = path.join(featureDir, `${taskId}.md`);
  fs.writeFileSync(storyFile, storyContent);

  const result = {
    taskId,
    title,
    feature,
    storyFile,
    subTasks: []
  };

  // Check if decomposition needed
  const analysis = analyzeForDecomposition(title);
  const shouldDecompose = options.deep ||
    (decompositionConfig.autoDecompose && analysis.shouldDecompose);

  const shouldSuggest = !options.deep &&
    !decompositionConfig.autoDecompose &&
    decompositionConfig.autoDetect &&
    analysis.shouldDecompose;

  if (shouldSuggest) {
    result.decompositionSuggested = true;
    result.suggestedCount = analysis.suggestedSubTasks.length;
    result.patterns = analysis.patterns;
  }

  if (shouldDecompose && analysis.suggestedSubTasks.length > 0) {
    // Create sub-task files
    let subNum = 1;
    const subTaskIds = [];

    for (const sub of analysis.suggestedSubTasks) {
      const deps = subNum > 1 ? [`${taskId}-${String(subNum - 1).padStart(2, '0')}`] : [];
      const subTask = generateSubTaskTemplate(taskId, subNum, sub.objective, sub.criteria, deps);

      const subTaskFile = path.join(featureDir, `${subTask.id}.md`);
      fs.writeFileSync(subTaskFile, subTask.content);

      subTaskIds.push(subTask.id);
      result.subTasks.push({
        id: subTask.id,
        objective: sub.objective,
        file: subTaskFile
      });
      subNum++;
    }

    // Update ready.json with parent and sub-tasks
    if (fs.existsSync(READY_PATH)) {
      try {
        const ready = JSON.parse(fs.readFileSync(READY_PATH, 'utf8'));
        ready.ready = ready.ready || [];

        // Add parent task
        ready.ready.push({
          id: taskId,
          title,
          type: 'parent',
          subTasks: subTaskIds,
          status: 'ready',
          priority: 'medium',
          createdAt: new Date().toISOString()
        });

        // Add sub-tasks
        for (let i = 0; i < result.subTasks.length; i++) {
          const sub = result.subTasks[i];
          ready.ready.push({
            id: sub.id,
            title: sub.objective,
            type: 'sub-task',
            parent: taskId,
            status: 'ready',
            priority: 'medium',
            dependencies: i > 0 ? [result.subTasks[i - 1].id] : [],
            createdAt: new Date().toISOString()
          });
        }

        fs.writeFileSync(READY_PATH, JSON.stringify(ready, null, 2));
        result.addedToReady = true;
      } catch (e) {
        result.addedToReady = false;
        result.readyError = e.message;
      }
    }

    result.decomposed = true;
  }

  return result;
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
Wogi Flow - Story Creation

Usage:
  flow story "<title>"                    Create standard story
  flow story "<title>" --deep             Create with decomposition
  flow story "<title>" <feature>          Specify feature folder
  flow story "<title>" <feature> --deep   Both options

Options:
  --deep     Automatically decompose into sub-tasks

Configuration (config.json):
  "storyDecomposition": {
    "autoDetect": true,        // Suggest decomposition when beneficial
    "autoDecompose": false,    // Auto-decompose without asking
    "complexityThreshold": "medium",
    "minSubTasks": 5,
    "edgeCases": true,
    "loadingStates": true,
    "errorStates": true
  }

Examples:
  flow story "Add user login"
  flow story "Add user login" --deep
  flow story "Add user login" authentication
  flow story "Add user login" authentication --deep
`);
    process.exit(0);
  }

  // Parse arguments
  const isDeep = args.includes('--deep');
  const filteredArgs = args.filter(a => a !== '--deep');

  if (filteredArgs.length === 0) {
    log('red', 'Error: Title is required');
    process.exit(1);
  }

  const title = filteredArgs[0];
  const feature = filteredArgs[1] || 'general';

  // Create story
  const result = createStory(title, feature, { deep: isDeep });

  // Output results
  console.log('');
  log('green', `✓ Created story: ${result.taskId}`);
  log('cyan', `  ${result.storyFile}`);
  console.log('');
  log('white', `Title: ${result.title}`);
  log('white', `Feature: ${result.feature}`);

  if (result.decomposed) {
    console.log('');
    log('cyan', `📋 Decomposed into ${result.subTasks.length} sub-tasks:`);
    result.subTasks.forEach(sub => {
      log('dim', `   ${sub.id}: ${sub.objective}`);
    });
    if (result.addedToReady) {
      console.log('');
      log('green', '✓ Added parent and sub-tasks to ready.json');
    }
  } else if (result.decompositionSuggested) {
    console.log('');
    log('yellow', `💡 This looks like a complex story (${result.patterns.join(', ')})`);
    log('yellow', `   Consider using --deep to decompose into ~${result.suggestedCount} sub-tasks`);
    log('dim', `   Run: flow story "${title}" ${feature} --deep`);
  }

  console.log('');
  log('dim', 'Next steps:');
  log('dim', '  1. Fill in the story details');
  log('dim', '  2. Check app-map.md for existing components');
  if (!result.decomposed) {
    log('dim', '  3. Add to ready.json when ready to implement');
  } else {
    log('dim', '  3. Start with: /wogi-start ' + result.subTasks[0].id);
  }
}

// Export for use by other modules
module.exports = {
  createStory,
  analyzeForDecomposition,
  generateStoryTemplate,
  generateSubTaskTemplate,
  getNextTaskNumber
};
