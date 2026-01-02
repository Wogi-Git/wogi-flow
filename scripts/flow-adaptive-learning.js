#!/usr/bin/env node

/**
 * Wogi Flow - Adaptive Learning for Hybrid Mode
 *
 * When a task fails with an executor model, this module:
 * 1. Analyzes WHY it failed
 * 2. Refines the prompt based on the failure
 * 3. Tracks what refinements were needed
 * 4. On success, updates the model adapter with learnings
 *
 * This creates a feedback loop that improves prompts over time.
 */

const fs = require('fs');
const path = require('path');
const { getProjectRoot, colors } = require('./flow-utils');
const { storeSingleLearning, getAdapterPath } = require('./flow-model-adapter');

const PROJECT_ROOT = getProjectRoot();
const LEARNING_LOG_PATH = path.join(PROJECT_ROOT, '.workflow', 'state', 'adaptive-learning.json');

// ============================================================
// Failure Analysis
// ============================================================

/**
 * Error categories with detection patterns and fix strategies
 */
const ERROR_CATEGORIES = {
  IMPORT_ERROR: {
    patterns: [
      /cannot find module/i,
      /module not found/i,
      /no exported member/i,
      /has no exported member/i,
      /cannot resolve/i,
      /failed to resolve import/i
    ],
    strategy: 'import_fix',
    description: 'Import path or export name incorrect'
  },
  TYPE_ERROR: {
    patterns: [
      /type '.*' is not assignable/i,
      /property '.*' does not exist/i,
      /argument of type/i,
      /expected \d+ arguments/i,
      /missing property/i,
      /is not a valid/i
    ],
    strategy: 'type_fix',
    description: 'TypeScript type mismatch'
  },
  SYNTAX_ERROR: {
    patterns: [
      /unexpected token/i,
      /parsing error/i,
      /syntax error/i,
      /unterminated string/i,
      /expected.*but got/i,
      /missing.*after/i
    ],
    strategy: 'syntax_fix',
    description: 'JavaScript/TypeScript syntax error'
  },
  MARKDOWN_POLLUTION: {
    patterns: [
      /```typescript/,
      /```jsx/,
      /```tsx/,
      /```javascript/,
      /Here's the/i,
      /Here is the/i,
      /I'll create/i,
      /Let me/i
    ],
    strategy: 'format_fix',
    description: 'Model included markdown or explanatory text'
  },
  INCOMPLETE_OUTPUT: {
    patterns: [
      /unexpected end of/i,
      /\.\.\./,
      /\/\/ \.\.\./,
      /TODO:/i,
      /FIXME:/i
    ],
    strategy: 'completion_fix',
    description: 'Model produced incomplete output'
  },
  HALLUCINATION: {
    patterns: [
      /does not exist/i,
      /is not defined/i,
      /cannot read property/i,
      /undefined is not/i
    ],
    strategy: 'context_fix',
    description: 'Model hallucinated non-existent code/imports'
  }
};

/**
 * Analyze a failure and categorize it
 * @param {string} error - Error message or output
 * @param {string} output - Model's output
 * @param {object} context - Task context
 * @returns {object} Failure analysis
 */
function analyzeFailure(error, output, context = {}) {
  const errorStr = String(error);
  const outputStr = String(output || '');

  const analysis = {
    timestamp: new Date().toISOString(),
    categories: [],
    primaryCategory: null,
    strategy: null,
    details: {},
    rawError: errorStr.slice(0, 500),
    outputSample: outputStr.slice(0, 300)
  };

  // Check each category
  for (const [category, config] of Object.entries(ERROR_CATEGORIES)) {
    for (const pattern of config.patterns) {
      if (pattern.test(errorStr) || pattern.test(outputStr)) {
        analysis.categories.push({
          category,
          strategy: config.strategy,
          description: config.description,
          matchedPattern: pattern.toString()
        });
        break;
      }
    }
  }

  // Set primary category (first match)
  if (analysis.categories.length > 0) {
    analysis.primaryCategory = analysis.categories[0].category;
    analysis.strategy = analysis.categories[0].strategy;
  } else {
    analysis.primaryCategory = 'UNKNOWN';
    analysis.strategy = 'generic_fix';
  }

  // Extract specific details based on category
  analysis.details = extractErrorDetails(errorStr, analysis.primaryCategory);

  return analysis;
}

/**
 * Extract specific details from error based on category
 */
function extractErrorDetails(error, category) {
  const details = {};

  switch (category) {
    case 'IMPORT_ERROR': {
      // Extract module name
      const moduleMatch = error.match(/(?:module|from) ['"]([^'"]+)['"]/i);
      if (moduleMatch) details.moduleName = moduleMatch[1];

      // Extract export name
      const exportMatch = error.match(/(?:member|export) ['"]?(\w+)['"]?/i);
      if (exportMatch) details.exportName = exportMatch[1];
      break;
    }
    case 'TYPE_ERROR': {
      // Extract type names
      const typeMatch = error.match(/type ['"]?([^'"]+)['"]? is not assignable to ['"]?([^'"]+)['"]?/i);
      if (typeMatch) {
        details.actualType = typeMatch[1];
        details.expectedType = typeMatch[2];
      }

      // Extract property name
      const propMatch = error.match(/property ['"]?(\w+)['"]?/i);
      if (propMatch) details.propertyName = propMatch[1];
      break;
    }
    case 'SYNTAX_ERROR': {
      // Extract line number if present
      const lineMatch = error.match(/line (\d+)/i);
      if (lineMatch) details.line = parseInt(lineMatch[1]);
      break;
    }
  }

  return details;
}

// ============================================================
// Prompt Refinement
// ============================================================

/**
 * Refinement strategies for different error types
 */
const REFINEMENT_STRATEGIES = {
  import_fix: {
    prefix: `CRITICAL: Your previous output had IMPORT ERRORS.
Pay close attention to the "Available Imports" section below.
Use EXACT import paths and export names as shown.
Do NOT guess or create new import paths.`,
    suffix: `Remember: Use ONLY imports from the "Available Imports" section. Copy them exactly.`
  },

  type_fix: {
    prefix: `CRITICAL: Your previous output had TYPE ERRORS.
Pay close attention to the type definitions provided.
Match prop types EXACTLY as defined.
Do NOT add optional properties that aren't in the type.`,
    suffix: `Remember: Match types exactly. If unsure, use the simplest valid type.`
  },

  syntax_fix: {
    prefix: `CRITICAL: Your previous output had SYNTAX ERRORS.
Output ONLY valid TypeScript/JavaScript code.
NO markdown fences. NO explanatory text. NO preamble.
Start directly with the code (import statements or first line of code).`,
    suffix: `Remember: Pure code only. The output will be saved directly to a file.`
  },

  format_fix: {
    prefix: `CRITICAL: Your previous output included MARKDOWN or EXPLANATIONS.
Output ONLY the raw code. NO markdown fences (\`\`\`).
NO "Here's the code" text. NO explanations before or after.
Start IMMEDIATELY with the first line of code.`,
    suffix: `CRITICAL: Start your response with actual code (import or first statement). Nothing else.`
  },

  completion_fix: {
    prefix: `CRITICAL: Your previous output was INCOMPLETE.
You MUST output the COMPLETE file content.
Do NOT use "..." or "// rest of code" placeholders.
Do NOT truncate. Include EVERY line.`,
    suffix: `Remember: Complete code only. No placeholders, no truncation.`
  },

  context_fix: {
    prefix: `CRITICAL: Your previous output referenced NON-EXISTENT code.
Use ONLY components, hooks, and utilities that exist in the project.
Check the "Available Components" and "Available Imports" sections.
Do NOT invent or hallucinate imports or function names.`,
    suffix: `Remember: Only use what's explicitly listed in the context. When unsure, keep it simple.`
  },

  generic_fix: {
    prefix: `CRITICAL: Your previous attempt failed. Please try again more carefully.
Follow the instructions exactly. Output only what is requested.`,
    suffix: `Take your time and ensure the output is correct.`
  }
};

/**
 * Refine prompt based on failure analysis
 * @param {string} originalPrompt - Original prompt
 * @param {object} failure - Failure analysis from analyzeFailure()
 * @param {array} previousAttempts - Previous failure analyses
 * @returns {object} Refined prompt and metadata
 */
function refinePromptForRetry(originalPrompt, failure, previousAttempts = []) {
  const strategy = failure.strategy || 'generic_fix';
  const refinements = REFINEMENT_STRATEGIES[strategy] || REFINEMENT_STRATEGIES.generic_fix;

  // Build refinement context
  let refinementContext = '';

  // Add specific error details
  if (failure.details && Object.keys(failure.details).length > 0) {
    refinementContext += '\n\nSPECIFIC ISSUE:\n';
    for (const [key, value] of Object.entries(failure.details)) {
      refinementContext += `- ${key}: ${value}\n`;
    }
  }

  // Add learnings from previous attempts
  if (previousAttempts.length > 0) {
    refinementContext += '\n\nPREVIOUS ERRORS TO AVOID:\n';
    const uniqueCategories = [...new Set(previousAttempts.map(a => a.primaryCategory))];
    for (const cat of uniqueCategories) {
      const catConfig = ERROR_CATEGORIES[cat];
      if (catConfig) {
        refinementContext += `- ${catConfig.description}\n`;
      }
    }
  }

  // Construct refined prompt
  const refinedPrompt = `${refinements.prefix}
${refinementContext}
---

${originalPrompt}

---
${refinements.suffix}`;

  return {
    prompt: refinedPrompt,
    strategy,
    addedInstructions: {
      prefix: refinements.prefix,
      suffix: refinements.suffix,
      context: refinementContext
    },
    attemptNumber: previousAttempts.length + 2 // +2 because first attempt was 1
  };
}

// ============================================================
// Success Recording
// ============================================================

/**
 * Record a successful recovery to the model adapter
 * @param {string} modelName - Model identifier
 * @param {array} failures - Array of failure analyses that led to success
 * @param {object} successContext - What finally worked
 */
function recordSuccessfulRecovery(modelName, failures, successContext = {}) {
  if (!failures || failures.length === 0) return;

  // Group failures by category
  const categoryCounts = {};
  for (const failure of failures) {
    const cat = failure.primaryCategory;
    if (!categoryCounts[cat]) {
      categoryCounts[cat] = { count: 0, details: [] };
    }
    categoryCounts[cat].count++;
    if (failure.details && Object.keys(failure.details).length > 0) {
      categoryCounts[cat].details.push(failure.details);
    }
  }

  // Generate learning entry
  const learnings = [];
  const date = new Date().toISOString().split('T')[0];

  for (const [category, data] of Object.entries(categoryCounts)) {
    const config = ERROR_CATEGORIES[category];
    if (!config) continue;

    learnings.push(`### ${date} - Learned from ${data.count} ${category} failures`);
    learnings.push('');
    learnings.push(`**Issue**: ${config.description}`);
    learnings.push(`**Strategy**: ${config.strategy}`);

    // Add specific guidance based on category
    const guidance = generateGuidanceFromFailures(category, data.details);
    if (guidance) {
      learnings.push(`**Do**: ${guidance.do}`);
      learnings.push(`**Don't**: ${guidance.dont}`);
    }

    learnings.push('');
  }

  if (learnings.length > 0) {
    // Add to model adapter file
    const learningText = learnings.join('\n');
    storeSingleLearning(modelName, learningText, {
      taskId: successContext.taskId || 'adaptive-recovery',
      trigger: 'adaptive-learning',
      sourceContext: `Recovered after ${failures.length} failures`
    });

    // Also log to adaptive learning log
    logLearning(modelName, failures, successContext);

    console.log(`${colors.green}   ✅ Learning recorded to ${modelName} adapter${colors.reset}`);
  }
}

/**
 * Generate specific do/don't guidance from failure details
 */
function generateGuidanceFromFailures(category, details) {
  switch (category) {
    case 'IMPORT_ERROR': {
      const modules = details.map(d => d.moduleName).filter(Boolean);
      const exports = details.map(d => d.exportName).filter(Boolean);
      return {
        do: 'Copy import paths exactly from the "Available Imports" section',
        dont: modules.length > 0
          ? `Don't use these incorrect paths: ${modules.slice(0, 3).join(', ')}`
          : 'Don\'t guess import paths'
      };
    }
    case 'TYPE_ERROR': {
      return {
        do: 'Match prop types exactly as defined in the interface',
        dont: 'Don\'t add extra properties or change required/optional status'
      };
    }
    case 'MARKDOWN_POLLUTION': {
      return {
        do: 'Start response immediately with code (import statement or first line)',
        dont: 'Don\'t include markdown fences, "Here\'s the code", or explanations'
      };
    }
    case 'INCOMPLETE_OUTPUT': {
      return {
        do: 'Output complete, working code with all functions implemented',
        dont: 'Don\'t use "...", "// rest of code", or other placeholders'
      };
    }
    default:
      return null;
  }
}

/**
 * Log learning to persistent file for analysis
 */
function logLearning(modelName, failures, context) {
  let log = { entries: [] };

  if (fs.existsSync(LEARNING_LOG_PATH)) {
    try {
      log = JSON.parse(fs.readFileSync(LEARNING_LOG_PATH, 'utf-8'));
    } catch (e) {
      log = { entries: [] };
    }
  }

  log.entries.push({
    timestamp: new Date().toISOString(),
    model: modelName,
    failureCount: failures.length,
    categories: failures.map(f => f.primaryCategory),
    context: context.taskId || 'unknown',
    recovered: true
  });

  // Keep last 100 entries
  if (log.entries.length > 100) {
    log.entries = log.entries.slice(-100);
  }

  const dir = path.dirname(LEARNING_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(LEARNING_LOG_PATH, JSON.stringify(log, null, 2));
}

// ============================================================
// Adaptive Retry Loop
// ============================================================

/**
 * Adaptive retry wrapper for executor calls
 * @param {function} executeFn - Function that executes the task: (prompt) => output
 * @param {function} validateFn - Function that validates output: (output) => { success, error }
 * @param {string} originalPrompt - Original prompt
 * @param {object} options - Options: maxRetries, modelName, taskContext
 * @returns {object} Result with output, success, failures, learningsRecorded
 */
async function adaptiveRetry(executeFn, validateFn, originalPrompt, options = {}) {
  const {
    maxRetries = 5,
    modelName = 'unknown',
    taskContext = {}
  } = options;

  const failures = [];
  let currentPrompt = originalPrompt;
  let lastOutput = null;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Execute with current prompt
      const output = await executeFn(currentPrompt);
      lastOutput = output;

      // Validate output
      const validation = await validateFn(output);

      if (validation.success) {
        // Success! Record learnings if we had failures
        if (failures.length > 0) {
          recordSuccessfulRecovery(modelName, failures, {
            taskId: taskContext.taskId,
            attemptsTaken: attempt,
            finalPromptLength: currentPrompt.length
          });
        }

        return {
          success: true,
          output,
          attempts: attempt,
          failures,
          learningsRecorded: failures.length > 0
        };
      }

      // Failed validation
      lastError = validation.error;

    } catch (error) {
      lastError = error.message || String(error);
    }

    // Analyze failure
    const failure = analyzeFailure(lastError, lastOutput, taskContext);
    failures.push(failure);

    console.log(`${colors.yellow}   ⚠️  Attempt ${attempt} failed: ${failure.primaryCategory}${colors.reset}`);

    // Refine prompt for next attempt
    if (attempt < maxRetries) {
      const refined = refinePromptForRetry(originalPrompt, failure, failures.slice(0, -1));
      currentPrompt = refined.prompt;
      console.log(`${colors.dim}   📝 Refining prompt with ${refined.strategy} strategy${colors.reset}`);
    }
  }

  // All attempts failed
  return {
    success: false,
    output: lastOutput,
    error: lastError,
    attempts: maxRetries,
    failures,
    learningsRecorded: false
  };
}

// ============================================================
// Community Sharing - Export Learnings
// ============================================================

/**
 * Export aggregated learnings for contribution to wogi-flow
 * This allows users to share their model-specific learnings with the community
 */
function exportLearningsForSharing() {
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    models: {}
  };

  // Load learning log
  if (!fs.existsSync(LEARNING_LOG_PATH)) {
    return { success: false, error: 'No learning data found' };
  }

  const log = JSON.parse(fs.readFileSync(LEARNING_LOG_PATH, 'utf-8'));

  // Aggregate by model
  for (const entry of log.entries) {
    const model = entry.model;
    if (!exportData.models[model]) {
      exportData.models[model] = {
        totalRecoveries: 0,
        categoryFrequency: {},
        learnings: []
      };
    }

    exportData.models[model].totalRecoveries++;

    for (const cat of entry.categories) {
      exportData.models[model].categoryFrequency[cat] =
        (exportData.models[model].categoryFrequency[cat] || 0) + 1;
    }
  }

  // Load model adapter files and extract learnings sections
  const adaptersDir = path.join(PROJECT_ROOT, '.workflow', 'model-adapters');
  if (fs.existsSync(adaptersDir)) {
    const adapterFiles = fs.readdirSync(adaptersDir).filter(f => f.endsWith('.md') && !f.startsWith('_'));

    for (const file of adapterFiles) {
      const modelName = file.replace('.md', '');
      const content = fs.readFileSync(path.join(adaptersDir, file), 'utf-8');

      // Extract learnings section
      const learningsMatch = content.match(/## Learnings\n([\s\S]*?)(?=\n## |$)/);
      if (learningsMatch && learningsMatch[1].trim()) {
        if (!exportData.models[modelName]) {
          exportData.models[modelName] = {
            totalRecoveries: 0,
            categoryFrequency: {},
            learnings: []
          };
        }

        // Parse individual learnings
        const learningBlocks = learningsMatch[1].split(/\n### /).filter(Boolean);
        for (const block of learningBlocks) {
          if (block.includes('Auto-learned') || block.includes('adaptive-learning')) {
            exportData.models[modelName].learnings.push(block.trim());
          }
        }
      }
    }
  }

  // Generate summary
  exportData.summary = {
    totalModels: Object.keys(exportData.models).length,
    totalLearnings: Object.values(exportData.models).reduce((sum, m) => sum + m.learnings.length, 0),
    topIssues: getTopIssues(exportData.models)
  };

  return { success: true, data: exportData };
}

/**
 * Get top issues across all models
 */
function getTopIssues(models) {
  const allCategories = {};

  for (const model of Object.values(models)) {
    for (const [cat, count] of Object.entries(model.categoryFrequency)) {
      allCategories[cat] = (allCategories[cat] || 0) + count;
    }
  }

  return Object.entries(allCategories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({
      category,
      count,
      description: ERROR_CATEGORIES[category]?.description || 'Unknown'
    }));
}

/**
 * Format export for PR submission
 */
function formatExportForPR(exportData) {
  const lines = [
    '# Model Adapter Learnings Contribution',
    '',
    `Exported: ${exportData.exportedAt}`,
    `Models: ${exportData.summary.totalModels}`,
    `Learnings: ${exportData.summary.totalLearnings}`,
    '',
    '## Top Issues Encountered',
    ''
  ];

  for (const issue of exportData.summary.topIssues) {
    lines.push(`- **${issue.category}** (${issue.count}x): ${issue.description}`);
  }

  lines.push('', '## Per-Model Learnings', '');

  for (const [model, data] of Object.entries(exportData.models)) {
    if (data.learnings.length === 0) continue;

    lines.push(`### ${model}`, '');
    lines.push(`Recoveries: ${data.totalRecoveries}`, '');

    for (const learning of data.learnings.slice(0, 5)) {
      lines.push('```');
      lines.push(learning);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Core functions
  analyzeFailure,
  refinePromptForRetry,
  recordSuccessfulRecovery,
  adaptiveRetry,

  // Constants for external use
  ERROR_CATEGORIES,
  REFINEMENT_STRATEGIES,

  // Utilities
  extractErrorDetails,
  generateGuidanceFromFailures,
  logLearning,

  // Community sharing
  exportLearningsForSharing,
  formatExportForPR
};

// ============================================================
// CLI
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'stats': {
      // Show learning statistics
      if (fs.existsSync(LEARNING_LOG_PATH)) {
        const log = JSON.parse(fs.readFileSync(LEARNING_LOG_PATH, 'utf-8'));
        console.log('\n📊 Adaptive Learning Statistics\n');
        console.log(`Total recoveries: ${log.entries.length}`);

        // Group by model
        const byModel = {};
        for (const entry of log.entries) {
          if (!byModel[entry.model]) {
            byModel[entry.model] = { count: 0, categories: {} };
          }
          byModel[entry.model].count++;
          for (const cat of entry.categories) {
            byModel[entry.model].categories[cat] = (byModel[entry.model].categories[cat] || 0) + 1;
          }
        }

        console.log('\nBy model:');
        for (const [model, data] of Object.entries(byModel)) {
          console.log(`\n  ${model}: ${data.count} recoveries`);
          for (const [cat, count] of Object.entries(data.categories)) {
            console.log(`    - ${cat}: ${count}`);
          }
        }
      } else {
        console.log('No adaptive learning data yet.');
      }
      break;
    }

    case 'test': {
      // Test failure analysis
      const testErrors = [
        "Cannot find module '@/components/Button'",
        "Type 'string' is not assignable to type 'number'",
        "Unexpected token, expected '}'",
        "```typescript\nimport React from 'react'",
        "// ... rest of component"
      ];

      console.log('\n🧪 Testing Failure Analysis\n');
      for (const error of testErrors) {
        const analysis = analyzeFailure(error, '');
        console.log(`Error: "${error.slice(0, 50)}..."`);
        console.log(`  Category: ${analysis.primaryCategory}`);
        console.log(`  Strategy: ${analysis.strategy}`);
        console.log('');
      }
      break;
    }

    case 'export': {
      // Export learnings for community contribution
      console.log('\n📤 Exporting Learnings for Community Contribution\n');

      const result = exportLearningsForSharing();

      if (!result.success) {
        console.log(`${colors.yellow}No learning data to export yet.${colors.reset}`);
        console.log('Run some hybrid mode tasks first to generate learnings.');
        process.exit(1);
      }

      const { data } = result;
      console.log(`Models with learnings: ${data.summary.totalModels}`);
      console.log(`Total learnings: ${data.summary.totalLearnings}`);

      if (data.summary.topIssues.length > 0) {
        console.log('\nTop issues encountered:');
        for (const issue of data.summary.topIssues) {
          console.log(`  - ${issue.category} (${issue.count}x): ${issue.description}`);
        }
      }

      // Save export file
      const exportPath = path.join(PROJECT_ROOT, '.workflow', 'learnings-export.json');
      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
      console.log(`\n${colors.green}✅ Exported to: ${exportPath}${colors.reset}`);

      // Also create PR-ready markdown
      const prPath = path.join(PROJECT_ROOT, '.workflow', 'learnings-contribution.md');
      fs.writeFileSync(prPath, formatExportForPR(data));
      console.log(`${colors.green}✅ PR-ready format: ${prPath}${colors.reset}`);

      console.log(`
${colors.cyan}To contribute these learnings to wogi-flow:${colors.reset}
1. Fork https://github.com/your-org/wogi-flow
2. Copy ${prPath} content to your PR
3. Submit PR with title: "model-adapters: community learnings"

Your learnings help all wogi-flow users get better results!
`);
      break;
    }

    default:
      console.log(`
Wogi Flow - Adaptive Learning

Usage:
  node flow-adaptive-learning.js <command>

Commands:
  stats     Show learning statistics
  test      Test failure analysis with sample errors
  export    Export learnings for community contribution

This module enables hybrid mode to learn from failures:
1. When executor fails, analyze WHY
2. Refine prompt based on failure category
3. Retry with improved instructions
4. On success, update model adapter with learnings
5. Export learnings to share with the community
`);
  }
}
