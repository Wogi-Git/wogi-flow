#!/usr/bin/env node

/**
 * Wogi Flow - Parallel Execution Module
 *
 * Enables parallel task execution with dependency detection and worktree isolation.
 *
 * Features:
 * - Detects independent tasks that can run in parallel
 * - Manages concurrent execution with configurable limits
 * - Integrates with worktree isolation for safe parallel execution
 * - Provides progress visibility for all running tasks
 *
 * Usage:
 *   const { canRunInParallel, executeParallel, detectDependencies } = require('./flow-parallel');
 *
 *   if (canRunInParallel(tasks)) {
 *     await executeParallel(tasks, { maxConcurrent: 3 });
 *   }
 */

const fs = require('fs');
const path = require('path');
const { getProjectRoot } = require('./flow-utils');

// ============================================================
// Configuration
// ============================================================

/**
 * Load parallel execution config from config.json
 * @param {string} [projectRoot] - Project root path (defaults to getProjectRoot())
 */
function loadConfig(projectRoot = getProjectRoot()) {
  const configPath = path.join(projectRoot, '.workflow', 'config.json');
  if (!fs.existsSync(configPath)) {
    return getDefaultConfig();
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return {
      ...getDefaultConfig(),
      ...config.parallel
    };
  } catch {
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    enabled: true,
    maxConcurrent: 3,
    autoApprove: false,
    requireWorktree: true,
    showProgress: true
  };
}

// ============================================================
// Dependency Detection
// ============================================================

/**
 * Detect dependencies between tasks
 *
 * @param {Array} tasks - Array of task objects with { id, dependencies, files }
 * @returns {Object} Dependency graph { taskId: [dependsOn...] }
 */
function detectDependencies(tasks) {
  const dependencies = {};

  for (const task of tasks) {
    dependencies[task.id] = [];

    // Explicit dependencies from task definition
    if (task.dependencies && Array.isArray(task.dependencies)) {
      dependencies[task.id].push(...task.dependencies);
    }

    // File-based dependency detection
    if (task.files && Array.isArray(task.files)) {
      for (const otherTask of tasks) {
        if (otherTask.id === task.id) continue;

        // Check if this task modifies files that the other task depends on
        if (otherTask.files && Array.isArray(otherTask.files)) {
          const overlap = task.files.some(f => otherTask.files.includes(f));
          if (overlap && !dependencies[task.id].includes(otherTask.id)) {
            // Only add dependency if order matters (task comes after otherTask in list)
            const taskIndex = tasks.findIndex(t => t.id === task.id);
            const otherIndex = tasks.findIndex(t => t.id === otherTask.id);
            if (otherIndex < taskIndex) {
              dependencies[task.id].push(otherTask.id);
            }
          }
        }
      }
    }
  }

  return dependencies;
}

/**
 * Find tasks that can run in parallel (no unmet dependencies)
 *
 * @param {Array} tasks - Array of task objects
 * @param {Set} completed - Set of completed task IDs
 * @param {Object} dependencies - Dependency graph
 * @returns {Array} Tasks that can run now
 */
function findParallelizable(tasks, completed = new Set(), dependencies = null) {
  const deps = dependencies || detectDependencies(tasks);
  const parallelizable = [];

  for (const task of tasks) {
    if (completed.has(task.id)) continue;

    const taskDeps = deps[task.id] || [];
    const unmetDeps = taskDeps.filter(d => !completed.has(d));

    if (unmetDeps.length === 0) {
      parallelizable.push(task);
    }
  }

  return parallelizable;
}

/**
 * Check if tasks can run in parallel
 *
 * @param {Array} tasks - Tasks to check
 * @returns {boolean} True if at least 2 tasks can run in parallel
 */
function canRunInParallel(tasks) {
  if (!tasks || tasks.length < 2) return false;

  const parallelizable = findParallelizable(tasks);
  return parallelizable.length >= 2;
}

// ============================================================
// Progress Tracking
// ============================================================

/**
 * Create a progress tracker for parallel execution
 */
function createProgressTracker(tasks) {
  const state = {
    total: tasks.length,
    completed: 0,
    inProgress: new Set(),
    results: {},
    startTime: Date.now()
  };

  return {
    start(taskId) {
      state.inProgress.add(taskId);
      this.render();
    },

    complete(taskId, result) {
      state.inProgress.delete(taskId);
      state.completed++;
      state.results[taskId] = result;
      this.render();
    },

    fail(taskId, error) {
      state.inProgress.delete(taskId);
      state.results[taskId] = { success: false, error: error.message };
      this.render();
    },

    render() {
      const elapsed = Math.round((Date.now() - state.startTime) / 1000);
      const percent = Math.round((state.completed / state.total) * 100);
      const bar = '█'.repeat(Math.round(percent / 5)) + '░'.repeat(20 - Math.round(percent / 5));

      console.log('\n' + '─'.repeat(60));
      console.log(`⏱  Elapsed: ${elapsed}s | Progress: ${state.completed}/${state.total} (${percent}%)`);
      console.log(`[${bar}]`);

      if (state.inProgress.size > 0) {
        console.log(`🔄 Running: ${[...state.inProgress].join(', ')}`);
      }
      console.log('─'.repeat(60));
    },

    getSummary() {
      const successful = Object.values(state.results).filter(r => r.success).length;
      const failed = Object.values(state.results).filter(r => !r.success).length;
      const elapsed = Math.round((Date.now() - state.startTime) / 1000);

      return {
        total: state.total,
        completed: state.completed,
        successful,
        failed,
        elapsed,
        results: state.results
      };
    }
  };
}

// ============================================================
// Parallel Execution
// ============================================================

/**
 * Execute tasks in parallel with dependency awareness
 *
 * @param {Array} tasks - Tasks to execute
 * @param {Function} executor - Async function(task) to execute each task
 * @param {Object} options - Execution options
 * @returns {Object} Execution results
 */
async function executeParallel(tasks, executor, options = {}) {
  const config = loadConfig(options.projectRoot);
  const {
    maxConcurrent = config.maxConcurrent,
    showProgress = config.showProgress,
    onStart,
    onComplete,
    onError
  } = options;

  const dependencies = detectDependencies(tasks);
  const completed = new Set();
  const tracker = showProgress ? createProgressTracker(tasks) : null;

  // Process tasks in waves (respecting dependencies)
  while (completed.size < tasks.length) {
    const parallelizable = findParallelizable(tasks, completed, dependencies);

    if (parallelizable.length === 0) {
      // Check for circular dependencies
      const remaining = tasks.filter(t => !completed.has(t.id));
      if (remaining.length > 0) {
        throw new Error(`Circular dependency detected among: ${remaining.map(t => t.id).join(', ')}`);
      }
      break;
    }

    // Execute up to maxConcurrent tasks at once
    const batch = parallelizable.slice(0, maxConcurrent);
    const promises = batch.map(async (task) => {
      if (tracker) tracker.start(task.id);
      if (onStart) onStart(task);

      try {
        const result = await executor(task);
        completed.add(task.id);

        if (tracker) tracker.complete(task.id, result);
        if (onComplete) onComplete(task, result);

        return { taskId: task.id, success: true, result };
      } catch (error) {
        completed.add(task.id); // Mark as done even on failure to prevent infinite loop

        if (tracker) tracker.fail(task.id, error);
        if (onError) onError(task, error);

        return { taskId: task.id, success: false, error: error.message };
      }
    });

    await Promise.all(promises);
  }

  return tracker ? tracker.getSummary() : { completed: completed.size };
}

/**
 * Check if user approval is needed for parallel execution
 */
function needsApproval(tasks, config = null) {
  const cfg = config || loadConfig();

  if (!cfg.enabled) return { needed: false, reason: 'parallel-disabled' };
  if (cfg.autoApprove) return { needed: false, reason: 'auto-approved' };
  if (tasks.length < 2) return { needed: false, reason: 'single-task' };

  const parallelizable = findParallelizable(tasks);
  if (parallelizable.length < 2) return { needed: false, reason: 'dependencies' };

  return {
    needed: true,
    reason: 'manual-approval-required',
    tasks: parallelizable.map(t => t.id),
    message: `${parallelizable.length} tasks can run in parallel. Approve parallel execution?`
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Configuration
  loadConfig,
  getDefaultConfig,

  // Dependency detection
  detectDependencies,
  findParallelizable,
  canRunInParallel,

  // Execution
  executeParallel,
  createProgressTracker,
  needsApproval
};

// ============================================================
// CLI
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'config': {
      const config = loadConfig();
      console.log('\n📊 Parallel Execution Configuration:\n');
      console.log(JSON.stringify(config, null, 2));
      break;
    }

    case 'check': {
      // Load tasks from ready.json and check for parallelizable ones
      const readyPath = path.join(process.cwd(), '.workflow', 'state', 'ready.json');
      if (!fs.existsSync(readyPath)) {
        console.log('No ready.json found');
        process.exit(1);
      }

      const ready = JSON.parse(fs.readFileSync(readyPath, 'utf-8'));
      const tasks = (ready.tasks || []).filter(t => t.status === 'pending' || t.status === 'ready');

      if (tasks.length === 0) {
        console.log('No tasks ready for execution');
        process.exit(0);
      }

      const deps = detectDependencies(tasks);
      const parallelizable = findParallelizable(tasks);

      console.log('\n📋 Task Analysis:\n');
      console.log(`Total tasks: ${tasks.length}`);
      console.log(`Can run in parallel: ${parallelizable.length}`);
      console.log(`\nParallelizable tasks:`);
      parallelizable.forEach(t => console.log(`  - ${t.id}: ${t.title || t.description || 'No description'}`));

      console.log('\nDependency graph:');
      for (const [taskId, taskDeps] of Object.entries(deps)) {
        if (taskDeps.length > 0) {
          console.log(`  ${taskId} depends on: ${taskDeps.join(', ')}`);
        }
      }
      break;
    }

    default:
      console.log(`
Wogi Flow - Parallel Execution

Usage:
  node flow-parallel.js <command>

Commands:
  config        Show parallel execution configuration
  check         Analyze tasks for parallel execution potential

Examples:
  node flow-parallel.js config
  node flow-parallel.js check
`);
  }
}
