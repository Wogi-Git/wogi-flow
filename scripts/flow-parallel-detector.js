#!/usr/bin/env node

/**
 * Wogi Flow - Parallel Execution Detector
 *
 * Automatically detects when tasks can run in parallel and suggests/executes
 * parallel execution based on configuration.
 *
 * Features:
 * - Analyzes task dependencies and file overlaps
 * - Suggests parallel execution when beneficial
 * - Auto-executes parallel tasks when configured
 * - Provides clear explanations of parallelization decisions
 */

const fs = require('fs');
const path = require('path');
const { getConfig, getProjectRoot } = require('./flow-utils');
const {
  detectDependencies,
  findParallelizable,
  canRunInParallel,
  getParallelConfig
} = require('./flow-parallel');

/**
 * Analyze tasks for parallel execution potential
 */
function analyzeParallelPotential(tasks) {
  if (!tasks || tasks.length < 2) {
    return {
      canParallelize: false,
      reason: 'insufficient-tasks',
      message: 'Need at least 2 tasks to parallelize'
    };
  }

  const dependencies = detectDependencies(tasks);
  const parallelizable = findParallelizable(tasks, new Set(), dependencies);
  const config = getParallelConfig();

  // Check minimum threshold
  const minTasks = config.minTasksForParallel || 2;
  if (parallelizable.length < minTasks) {
    return {
      canParallelize: false,
      reason: 'below-threshold',
      message: `Only ${parallelizable.length} tasks can run in parallel (minimum: ${minTasks})`,
      parallelizable: parallelizable.map(t => t.id)
    };
  }

  // Analyze file overlap for safety warnings
  const fileOverlaps = analyzeFileOverlaps(tasks, dependencies);

  // Calculate efficiency gain
  const efficiencyGain = calculateEfficiencyGain(tasks, parallelizable);

  return {
    canParallelize: true,
    parallelizable: parallelizable.map(t => ({
      id: t.id,
      title: t.title || t.description,
      files: t.files || []
    })),
    totalTasks: tasks.length,
    parallelCount: parallelizable.length,
    dependencies,
    fileOverlaps,
    efficiencyGain,
    waves: calculateWaves(tasks, dependencies),
    recommendation: generateRecommendation(parallelizable, efficiencyGain, fileOverlaps)
  };
}

/**
 * Analyze file overlaps that might cause issues
 */
function analyzeFileOverlaps(tasks, dependencies) {
  const overlaps = [];
  const fileToTasks = {};

  for (const task of tasks) {
    if (task.files && Array.isArray(task.files)) {
      for (const file of task.files) {
        if (!fileToTasks[file]) {
          fileToTasks[file] = [];
        }
        fileToTasks[file].push(task.id);
      }
    }
  }

  for (const [file, taskIds] of Object.entries(fileToTasks)) {
    if (taskIds.length > 1) {
      overlaps.push({
        file,
        tasks: taskIds,
        severity: taskIds.length > 2 ? 'high' : 'medium'
      });
    }
  }

  return overlaps;
}

/**
 * Calculate efficiency gain from parallel execution
 */
function calculateEfficiencyGain(tasks, parallelizable) {
  // Simple estimation based on parallelizable ratio
  const sequentialTime = tasks.length; // 1 unit per task
  const parallelTime = Math.ceil(tasks.length / parallelizable.length);

  return {
    sequential: sequentialTime,
    parallel: parallelTime,
    savedTime: sequentialTime - parallelTime,
    percentageGain: Math.round((1 - parallelTime / sequentialTime) * 100)
  };
}

/**
 * Calculate execution waves (groups that can run together)
 */
function calculateWaves(tasks, dependencies) {
  const waves = [];
  const completed = new Set();

  while (completed.size < tasks.length) {
    const wave = [];

    for (const task of tasks) {
      if (completed.has(task.id)) continue;

      const taskDeps = dependencies[task.id] || [];
      const allDepsComplete = taskDeps.every(d => completed.has(d));

      if (allDepsComplete) {
        wave.push(task.id);
      }
    }

    if (wave.length === 0) {
      // Circular dependency or stuck
      break;
    }

    waves.push(wave);
    wave.forEach(id => completed.add(id));
  }

  return waves;
}

/**
 * Generate a human-readable recommendation
 */
function generateRecommendation(parallelizable, efficiencyGain, fileOverlaps) {
  const lines = [];

  if (parallelizable.length >= 3) {
    lines.push('✅ RECOMMENDED: High parallelization potential');
  } else if (parallelizable.length >= 2) {
    lines.push('⚠️  POSSIBLE: Moderate parallelization potential');
  }

  lines.push(`   ${parallelizable.length} tasks can run simultaneously`);
  lines.push(`   ~${efficiencyGain.percentageGain}% time savings expected`);

  if (fileOverlaps.length > 0) {
    const highSeverity = fileOverlaps.filter(o => o.severity === 'high');
    if (highSeverity.length > 0) {
      lines.push(`   ⚠️  ${highSeverity.length} high-risk file overlaps detected`);
      lines.push(`      Consider enabling worktree isolation`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate suggestion message for user
 */
function generateSuggestionMessage(analysis) {
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════╗',
    '║         🔀 PARALLEL EXECUTION AVAILABLE              ║',
    '╠══════════════════════════════════════════════════════╣'
  ];

  lines.push(`║  ${analysis.parallelCount} of ${analysis.totalTasks} tasks can run in parallel`.padEnd(55) + '║');
  lines.push(`║  Estimated time savings: ~${analysis.efficiencyGain.percentageGain}%`.padEnd(55) + '║');

  lines.push('╠══════════════════════════════════════════════════════╣');
  lines.push('║  Parallelizable tasks:'.padEnd(55) + '║');

  for (const task of analysis.parallelizable.slice(0, 5)) {
    const title = task.title || task.id;
    const truncated = title.length > 45 ? title.substring(0, 42) + '...' : title;
    lines.push(`║    • ${truncated}`.padEnd(55) + '║');
  }

  if (analysis.parallelizable.length > 5) {
    lines.push(`║    ... and ${analysis.parallelizable.length - 5} more`.padEnd(55) + '║');
  }

  if (analysis.fileOverlaps.length > 0) {
    lines.push('╠══════════════════════════════════════════════════════╣');
    lines.push('║  ⚠️  File overlap warnings:'.padEnd(55) + '║');
    for (const overlap of analysis.fileOverlaps.slice(0, 3)) {
      const msg = `${overlap.file} → ${overlap.tasks.join(', ')}`;
      const truncated = msg.length > 47 ? msg.substring(0, 44) + '...' : msg;
      lines.push(`║    ${truncated}`.padEnd(55) + '║');
    }
  }

  lines.push('╠══════════════════════════════════════════════════════╣');
  lines.push('║  Options:'.padEnd(55) + '║');
  lines.push('║    [P] Run in parallel'.padEnd(55) + '║');
  lines.push('║    [S] Run sequentially'.padEnd(55) + '║');
  lines.push('║    [W] Run parallel with worktree isolation'.padEnd(55) + '║');
  lines.push('╚══════════════════════════════════════════════════════╝');

  return lines.join('\n');
}

/**
 * Check if parallel execution should be suggested
 */
function shouldSuggestParallel(tasks) {
  const config = getConfig();
  const parallelConfig = config.parallel || {};

  if (!parallelConfig.enabled) {
    return { suggest: false, reason: 'parallel-disabled' };
  }

  if (!parallelConfig.autoDetect) {
    return { suggest: false, reason: 'auto-detect-disabled' };
  }

  const analysis = analyzeParallelPotential(tasks);

  if (!analysis.canParallelize) {
    return { suggest: false, reason: analysis.reason };
  }

  if (parallelConfig.autoSuggest) {
    return {
      suggest: true,
      analysis,
      message: generateSuggestionMessage(analysis)
    };
  }

  return { suggest: false, reason: 'auto-suggest-disabled' };
}

/**
 * Check if parallel execution should auto-execute
 * Uses autoExecute config option (not autoApprove which is for manual triggers)
 */
function shouldAutoExecute(tasks) {
  const config = getConfig();
  const parallelConfig = config.parallel || {};

  if (!parallelConfig.enabled) return false;
  if (!parallelConfig.autoExecute) return false; // Use autoExecute, not autoApprove
  if (!parallelConfig.autoDetect) return false;

  const analysis = analyzeParallelPotential(tasks);
  return analysis.canParallelize;
}

/**
 * Load pending tasks from ready.json
 */
function loadPendingTasks() {
  const projectRoot = getProjectRoot();
  const readyPath = path.join(projectRoot, '.workflow', 'state', 'ready.json');

  if (!fs.existsSync(readyPath)) {
    return [];
  }

  try {
    const ready = JSON.parse(fs.readFileSync(readyPath, 'utf-8'));
    return (ready.tasks || []).filter(t =>
      t.status === 'pending' || t.status === 'ready'
    );
  } catch {
    return [];
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  analyzeParallelPotential,
  analyzeFileOverlaps,
  calculateEfficiencyGain,
  calculateWaves,
  generateRecommendation,
  generateSuggestionMessage,
  shouldSuggestParallel,
  shouldAutoExecute,
  loadPendingTasks
};

// ============================================================
// CLI
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'analyze': {
      const tasks = loadPendingTasks();
      if (tasks.length === 0) {
        console.log('No pending tasks found in ready.json');
        process.exit(0);
      }

      const analysis = analyzeParallelPotential(tasks);
      console.log('\n📊 Parallel Execution Analysis\n');
      console.log(`Total tasks: ${analysis.totalTasks || tasks.length}`);

      if (analysis.canParallelize) {
        console.log(`Can parallelize: ${analysis.parallelCount} tasks`);
        console.log(`\nExecution waves:`);
        analysis.waves.forEach((wave, i) => {
          console.log(`  Wave ${i + 1}: ${wave.join(', ')}`);
        });
        console.log(`\nEfficiency:`);
        console.log(`  Sequential time: ${analysis.efficiencyGain.sequential} units`);
        console.log(`  Parallel time: ${analysis.efficiencyGain.parallel} units`);
        console.log(`  Savings: ${analysis.efficiencyGain.percentageGain}%`);

        if (analysis.fileOverlaps.length > 0) {
          console.log(`\n⚠️  File overlaps:`);
          analysis.fileOverlaps.forEach(o => {
            console.log(`  ${o.file}: ${o.tasks.join(', ')} (${o.severity})`);
          });
        }

        console.log('\n' + analysis.recommendation);
      } else {
        console.log(`Cannot parallelize: ${analysis.reason}`);
        console.log(analysis.message);
      }
      break;
    }

    case 'suggest': {
      const tasks = loadPendingTasks();
      const result = shouldSuggestParallel(tasks);

      if (result.suggest) {
        console.log(result.message);
      } else {
        console.log(`Parallel execution not suggested: ${result.reason}`);
      }
      break;
    }

    case 'config': {
      const config = getParallelConfig();
      console.log('\n⚙️  Parallel Execution Configuration\n');
      console.log(JSON.stringify(config, null, 2));
      break;
    }

    default:
      console.log(`
Wogi Flow - Parallel Execution Detector

Usage:
  node flow-parallel-detector.js <command>

Commands:
  analyze     Analyze pending tasks for parallel potential
  suggest     Check if parallel execution should be suggested
  config      Show parallel execution configuration

Configuration (config.json):
  parallel.enabled: true           Enable parallel execution
  parallel.autoDetect: true        Auto-detect parallel opportunities
  parallel.autoSuggest: true       Suggest parallel execution to user
  parallel.autoApprove: false      Auto-execute without approval
  parallel.minTasksForParallel: 2  Minimum tasks to trigger
`);
  }
}
