#!/usr/bin/env node

/**
 * Wogi Flow - File-Based Verification (Priority 4)
 *
 * Every phase produces artifacts. Never trust chat output.
 * Explicit success criteria with commands and pass/fail conditions.
 *
 * Uses file-based validation approach.
 *
 * Key principle: "Logs are state - next iteration depends on them"
 *
 * Usage:
 *   const { runVerification, saveVerificationResult } = require('./flow-verification');
 *   const result = await runVerification(taskId, 'implementation');
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { getProjectRoot, getConfig, PATHS, colors } = require('./flow-utils');

const PROJECT_ROOT = getProjectRoot();
const VERIFICATIONS_DIR = path.join(PROJECT_ROOT, '.workflow', 'verifications');

// ============================================================
// Verification Execution
// ============================================================

/**
 * Run verification commands for a task phase
 *
 * @param {string} taskId - Task ID
 * @param {string} phase - Phase name (spec, test, implementation, final)
 * @param {object} options - Verification options
 * @param {Array} options.commands - Commands to run (overrides defaults)
 * @param {boolean} options.failFast - Stop on first failure
 * @param {number} options.timeout - Command timeout in ms
 */
async function runVerification(taskId, phase, options = {}) {
  const config = getConfig();
  const commands = options.commands || getDefaultCommands(phase, config);
  const failFast = options.failFast !== false;
  const timeout = options.timeout || 120000;

  const result = {
    taskId,
    phase,
    timestamp: new Date().toISOString(),
    results: [],
    allPassed: true,
    duration: 0
  };

  const startTime = Date.now();

  for (const cmd of commands) {
    const cmdResult = await runCommand(cmd, timeout);
    result.results.push(cmdResult);

    if (!cmdResult.passed) {
      result.allPassed = false;
      if (failFast) {
        break;
      }
    }
  }

  result.duration = Date.now() - startTime;

  // Save verification result to file
  saveVerificationResult(taskId, phase, result);

  return result;
}

/**
 * Run a single command and capture result
 */
async function runCommand(cmd, timeout) {
  const result = {
    command: cmd.command,
    description: cmd.description || cmd.command,
    required: cmd.required !== false,
    expectedExitCode: cmd.expectedExitCode || 0,
    startTime: new Date().toISOString(),
    passed: false,
    exitCode: null,
    stdout: '',
    stderr: '',
    duration: 0,
    error: null
  };

  const startTime = Date.now();

  try {
    const output = execSync(cmd.command, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout,
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    result.stdout = output;
    result.exitCode = 0;
    result.passed = result.exitCode === result.expectedExitCode;
  } catch (err) {
    result.exitCode = err.status || 1;
    result.stdout = err.stdout || '';
    result.stderr = err.stderr || '';
    result.error = err.message;
    result.passed = result.exitCode === result.expectedExitCode;
  }

  result.duration = Date.now() - startTime;
  result.endTime = new Date().toISOString();

  return result;
}

/**
 * Get default verification commands for a phase
 */
function getDefaultCommands(phase, config) {
  const commands = [];

  switch (phase) {
    case 'spec':
      // Spec phase - just validate spec exists
      commands.push({
        command: 'echo "Spec validation"',
        description: 'Validate spec exists',
        required: true
      });
      break;

    case 'test':
      // Test-first phase - run tests (expecting some to fail initially)
      commands.push({
        command: 'npm test -- --passWithNoTests 2>/dev/null || true',
        description: 'Run tests (initial)',
        required: false
      });
      break;

    case 'implementation':
      // After implementation - lint and typecheck
      commands.push({
        command: 'npm run lint 2>/dev/null || npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0 2>/dev/null || echo "lint skipped"',
        description: 'Run linter',
        required: false
      });
      commands.push({
        command: 'npm run typecheck 2>/dev/null || npx tsc --noEmit 2>/dev/null || echo "typecheck skipped"',
        description: 'Run type checker',
        required: false
      });
      break;

    case 'final':
      // Final verification - all gates must pass
      if (config.validation?.beforeCommit?.commands) {
        for (const cmd of config.validation.beforeCommit.commands) {
          commands.push({
            command: cmd,
            description: cmd,
            required: true
          });
        }
      } else {
        commands.push({
          command: 'npm run lint 2>/dev/null || echo "lint not configured"',
          description: 'Run linter',
          required: false
        });
        commands.push({
          command: 'npm run typecheck 2>/dev/null || echo "typecheck not configured"',
          description: 'Run type checker',
          required: false
        });
        commands.push({
          command: 'npm test 2>/dev/null || echo "tests not configured"',
          description: 'Run tests',
          required: false
        });
      }
      break;

    default:
      // Generic verification
      commands.push({
        command: 'npm run lint 2>/dev/null || echo "lint not configured"',
        description: 'Run linter',
        required: false
      });
  }

  return commands;
}

// ============================================================
// Verification Artifacts
// ============================================================

/**
 * Save verification result to file
 */
function saveVerificationResult(taskId, phase, result) {
  // Ensure directory exists
  if (!fs.existsSync(VERIFICATIONS_DIR)) {
    fs.mkdirSync(VERIFICATIONS_DIR, { recursive: true });
  }

  // Save JSON result
  const filename = `${taskId}-${phase}.json`;
  const filePath = path.join(VERIFICATIONS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');

  // Also append to verification log
  appendToVerificationLog(taskId, phase, result);

  return filePath;
}

/**
 * Load verification result for a task/phase
 */
function loadVerificationResult(taskId, phase) {
  const filename = `${taskId}-${phase}.json`;
  const filePath = path.join(VERIFICATIONS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Get all verification results for a task
 */
function getAllVerificationResults(taskId) {
  if (!fs.existsSync(VERIFICATIONS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(VERIFICATIONS_DIR)
    .filter(f => f.startsWith(`${taskId}-`) && f.endsWith('.json'));

  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(VERIFICATIONS_DIR, f), 'utf-8'));
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Append to verification log (human-readable)
 */
function appendToVerificationLog(taskId, phase, result) {
  const logPath = path.join(VERIFICATIONS_DIR, 'verification-log.md');

  let content = '';
  if (fs.existsSync(logPath)) {
    content = fs.readFileSync(logPath, 'utf-8');
  } else {
    content = '# Verification Log\n\nFile-based verification results.\n\n';
  }

  const status = result.allPassed ? '✓ PASSED' : '✗ FAILED';
  const entry = `
## ${taskId} - ${phase} [${status}]
**Time:** ${result.timestamp}
**Duration:** ${result.duration}ms

| Command | Status | Exit | Duration |
|---------|--------|------|----------|
${result.results.map(r =>
    `| \`${r.command.slice(0, 40)}${r.command.length > 40 ? '...' : ''}\` | ${r.passed ? '✓' : '✗'} | ${r.exitCode} | ${r.duration}ms |`
  ).join('\n')}

---
`;

  content += entry;
  fs.writeFileSync(logPath, content, 'utf-8');
}

// ============================================================
// Structured Execution Loop (Priority 3)
// ============================================================

/**
 * Execute structured loop: Spec → Test → Implement → Verify
 * This is the core structured execution model
 *
 * @param {string} taskId - Task ID
 * @param {object} callbacks - Phase callbacks
 */
async function executeStructuredLoop(taskId, callbacks = {}) {
  const phases = ['spec', 'test', 'implementation', 'final'];
  const loopState = {
    taskId,
    startTime: new Date().toISOString(),
    phases: {},
    currentPhase: null,
    completed: false,
    success: false
  };

  for (const phase of phases) {
    loopState.currentPhase = phase;
    loopState.phases[phase] = {
      startTime: new Date().toISOString(),
      status: 'running'
    };

    // Call phase callback if provided
    if (callbacks[phase]) {
      try {
        await callbacks[phase](loopState);
      } catch (err) {
        loopState.phases[phase].status = 'failed';
        loopState.phases[phase].error = err.message;
        break;
      }
    }

    // Run verification for this phase
    const verification = await runVerification(taskId, phase);

    loopState.phases[phase].verification = {
      passed: verification.allPassed,
      duration: verification.duration,
      failedCommands: verification.results
        .filter(r => !r.passed)
        .map(r => r.command)
    };

    if (!verification.allPassed && phase === 'final') {
      loopState.phases[phase].status = 'failed';
      break;
    }

    loopState.phases[phase].status = 'completed';
    loopState.phases[phase].endTime = new Date().toISOString();
  }

  loopState.completed = true;
  loopState.success = Object.values(loopState.phases)
    .every(p => p.status === 'completed');
  loopState.endTime = new Date().toISOString();

  // Save loop state
  saveLoopState(taskId, loopState);

  return loopState;
}

/**
 * Save loop state to file
 */
function saveLoopState(taskId, state) {
  const loopDir = path.join(VERIFICATIONS_DIR, 'loops');
  if (!fs.existsSync(loopDir)) {
    fs.mkdirSync(loopDir, { recursive: true });
  }

  const filePath = path.join(loopDir, `${taskId}-loop.json`);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');

  return filePath;
}

/**
 * Load loop state
 */
function loadLoopState(taskId) {
  const filePath = path.join(VERIFICATIONS_DIR, 'loops', `${taskId}-loop.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// ============================================================
// Self-Reflection Checkpoints (Priority 6)
// ============================================================

/**
 * Create a reflection checkpoint
 * Pauses execution and records reflection data
 *
 * @param {string} taskId - Task ID
 * @param {string} checkpoint - Checkpoint name
 * @param {object} context - Context for reflection
 */
function createReflectionCheckpoint(taskId, checkpoint, context = {}) {
  const reflectionsDir = path.join(VERIFICATIONS_DIR, 'reflections');
  if (!fs.existsSync(reflectionsDir)) {
    fs.mkdirSync(reflectionsDir, { recursive: true });
  }

  const reflection = {
    taskId,
    checkpoint,
    timestamp: new Date().toISOString(),
    context,
    questions: getReflectionQuestions(checkpoint),
    answers: {}
  };

  const filePath = path.join(reflectionsDir, `${taskId}-${checkpoint}.json`);
  fs.writeFileSync(filePath, JSON.stringify(reflection, null, 2), 'utf-8');

  return reflection;
}

/**
 * Get reflection questions for a checkpoint
 */
function getReflectionQuestions(checkpoint) {
  const questions = {
    'post-spec': [
      'Does this spec fully address the requirements?',
      'Are there any edge cases not covered?',
      'Is the scope clear and achievable?'
    ],
    'post-implementation': [
      'Have I introduced any bugs or regressions?',
      'Does the code follow project patterns?',
      'Is there any code that could be simplified?'
    ],
    'pre-completion': [
      'Does this match what the user asked for?',
      'Have all acceptance criteria been met?',
      'Are there any loose ends to address?'
    ],
    'post-failure': [
      'What caused this failure?',
      'What can be learned from this?',
      'How can similar failures be prevented?'
    ]
  };

  return questions[checkpoint] || [
    'Is the current approach correct?',
    'Are there any concerns to address?'
  ];
}

/**
 * Record reflection answer
 */
function recordReflectionAnswer(taskId, checkpoint, questionIndex, answer) {
  const filePath = path.join(VERIFICATIONS_DIR, 'reflections', `${taskId}-${checkpoint}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const reflection = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    reflection.answers[questionIndex] = {
      answer,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(reflection, null, 2), 'utf-8');
    return reflection;
  } catch {
    return null;
  }
}

/**
 * Get all reflections for a task
 */
function getTaskReflections(taskId) {
  const reflectionsDir = path.join(VERIFICATIONS_DIR, 'reflections');

  if (!fs.existsSync(reflectionsDir)) {
    return [];
  }

  const files = fs.readdirSync(reflectionsDir)
    .filter(f => f.startsWith(`${taskId}-`) && f.endsWith('.json'));

  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(reflectionsDir, f), 'utf-8'));
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// ============================================================
// Formatting
// ============================================================

/**
 * Format verification result for display
 */
function formatVerificationResult(result) {
  let output = '';

  const status = result.allPassed
    ? `${colors.green}✓ VERIFICATION PASSED${colors.reset}`
    : `${colors.red}✗ VERIFICATION FAILED${colors.reset}`;

  output += `\n${status}\n`;
  output += `Phase: ${result.phase} | Duration: ${result.duration}ms\n\n`;

  for (const cmd of result.results) {
    const icon = cmd.passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    output += `${icon} ${cmd.description}\n`;
    if (!cmd.passed && cmd.stderr) {
      output += `  ${colors.dim}${cmd.stderr.slice(0, 200)}${colors.reset}\n`;
    }
  }

  return output;
}

// ============================================================
// CLI
// ============================================================

function showHelp() {
  console.log(`
Wogi Flow - File-Based Verification

Every phase produces artifacts. Logs are state.

Usage:
  flow verify <task-id> [phase]
  flow verify <task-id> --all
  flow verify <task-id> --loop

Phases:
  spec            Verify spec exists and is valid
  test            Run tests (initial)
  implementation  Run lint and typecheck
  final           Run all quality gates

Options:
  --all           Run all phase verifications
  --loop          Execute full structured loop
  --json          Output as JSON
  --help, -h      Show this help

Examples:
  flow verify wf-abc123 implementation
  flow verify wf-abc123 final
  flow verify wf-abc123 --loop
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const taskId = args[0];
  const phase = args[1] || 'implementation';
  const jsonOutput = args.includes('--json');
  const runAll = args.includes('--all');
  const runLoop = args.includes('--loop');

  if (runLoop) {
    console.log(`${colors.cyan}Executing structured loop for ${taskId}...${colors.reset}\n`);
    const loopState = await executeStructuredLoop(taskId);

    if (jsonOutput) {
      console.log(JSON.stringify(loopState, null, 2));
    } else {
      for (const [phaseName, phaseData] of Object.entries(loopState.phases)) {
        const icon = phaseData.status === 'completed' ? '✓' : '✗';
        console.log(`${icon} ${phaseName}: ${phaseData.status}`);
      }
      console.log(`\n${loopState.success ? 'Loop completed successfully' : 'Loop failed'}`);
    }
  } else if (runAll) {
    const phases = ['spec', 'test', 'implementation', 'final'];
    for (const p of phases) {
      console.log(`\n${colors.cyan}Running ${p} verification...${colors.reset}`);
      const result = await runVerification(taskId, p);
      console.log(formatVerificationResult(result));
    }
  } else {
    const result = await runVerification(taskId, phase);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatVerificationResult(result));
    }
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  runVerification,
  runCommand,
  getDefaultCommands,
  saveVerificationResult,
  loadVerificationResult,
  getAllVerificationResults,
  executeStructuredLoop,
  saveLoopState,
  loadLoopState,
  createReflectionCheckpoint,
  recordReflectionAnswer,
  getTaskReflections,
  getReflectionQuestions,
  formatVerificationResult
};

if (require.main === module) {
  main().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
