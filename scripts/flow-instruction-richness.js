#!/usr/bin/env node

/**
 * Wogi Flow - Instruction Richness Module
 *
 * Controls how much detail Claude includes in instructions for the local LLM.
 * Higher richness = more Claude tokens spent = higher local LLM success rate.
 *
 * Key insight: Spending more Claude tokens upfront on rich instructions
 * saves total tokens by avoiding escalation failures.
 *
 * Usage:
 *   const { getInstructionRichness } = require('./flow-instruction-richness');
 *   const richness = getInstructionRichness('large');
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// Instruction Richness Levels
// ============================================================

/**
 * Richness levels control what context Claude includes for the local LLM.
 *
 * The goal is right-sizing: enough context to succeed without escalation,
 * but not wasteful for simple tasks.
 */
const INSTRUCTION_RICHNESS = {
  minimal: {
    claudeTokenBudget: 1500,
    includeProjectContext: false,
    includeTypeDefinitions: false,
    includeRelatedCode: false,
    includeExamples: false,
    includePatterns: false,
    includeFullFileContents: false,
    templateVerbosity: 'concise',
    description: 'For trivial changes - typos, single-line edits, simple renames'
  },

  standard: {
    claudeTokenBudget: 3000,
    includeProjectContext: true,
    includeTypeDefinitions: true,
    includeRelatedCode: false,
    includeExamples: false,
    includePatterns: true,
    includeFullFileContents: false,
    templateVerbosity: 'standard',
    description: 'For typical tasks - new functions, simple components, basic hooks'
  },

  rich: {
    claudeTokenBudget: 5000,
    includeProjectContext: true,
    includeTypeDefinitions: true,
    includeRelatedCode: true,
    includeExamples: true,
    includePatterns: true,
    includeFullFileContents: false,
    templateVerbosity: 'detailed',
    description: 'For complex tasks - components with state, services, multi-file changes'
  },

  maximum: {
    claudeTokenBudget: 7000,
    includeProjectContext: true,
    includeTypeDefinitions: true,
    includeRelatedCode: true,
    includeExamples: true,
    includePatterns: true,
    includeFullFileContents: true,
    templateVerbosity: 'comprehensive',
    description: 'For XL tasks - features, architectural changes, complex integrations'
  }
};

// ============================================================
// Complexity to Richness Mapping
// ============================================================

/**
 * Maps complexity level (from flow-complexity.js) to instruction richness
 */
const COMPLEXITY_TO_RICHNESS = {
  'small': 'minimal',
  'medium': 'standard',
  'large': 'rich',
  'xl': 'maximum'
};

/**
 * Gets the instruction richness configuration for a complexity level
 *
 * @param {string} complexityLevel - 'small', 'medium', 'large', or 'xl'
 * @param {Object} config - Optional config overrides from config.json
 * @returns {Object} - Richness configuration
 */
function getInstructionRichness(complexityLevel, config = {}) {
  // Map complexity to richness level
  let richnessLevel = COMPLEXITY_TO_RICHNESS[complexityLevel] || 'standard';

  // Check for minimum richness override in config
  const minRichness = config.minRichness;
  if (minRichness) {
    const levels = ['minimal', 'standard', 'rich', 'maximum'];
    const currentIndex = levels.indexOf(richnessLevel);
    const minIndex = levels.indexOf(minRichness);
    if (minIndex > currentIndex) {
      richnessLevel = minRichness;
    }
  }

  const richness = { ...INSTRUCTION_RICHNESS[richnessLevel] };

  // Add level name for reference
  richness.level = richnessLevel;

  return richness;
}

// ============================================================
// Context Loaders
// ============================================================

/**
 * Loads project context from workflow state
 */
function loadProjectContext(projectRoot) {
  const contextPath = path.join(projectRoot, '.workflow', 'state', 'hybrid-context.md');
  const decisionsPath = path.join(projectRoot, '.workflow', 'state', 'decisions.md');
  const projectPath = path.join(projectRoot, '.workflow', 'specs', 'project.md');

  let context = '';

  // Try hybrid-context first (optimized for hybrid mode)
  if (fs.existsSync(contextPath)) {
    context += fs.readFileSync(contextPath, 'utf-8');
  }

  // Add project overview
  if (fs.existsSync(projectPath)) {
    const projectMd = fs.readFileSync(projectPath, 'utf-8');
    // Extract just the summary section
    const summaryMatch = projectMd.match(/## Summary[\s\S]*?(?=##|$)/);
    if (summaryMatch) {
      context += '\n\n### Project Summary\n' + summaryMatch[0];
    }
  }

  return context || null;
}

/**
 * Loads coding patterns from decisions.md
 */
function loadPatterns(projectRoot) {
  const decisionsPath = path.join(projectRoot, '.workflow', 'state', 'decisions.md');

  if (!fs.existsSync(decisionsPath)) {
    return null;
  }

  const content = fs.readFileSync(decisionsPath, 'utf-8');

  // Extract relevant sections (Coding Standards, Component Architecture)
  const sections = [];

  const codingMatch = content.match(/## Coding Standards[\s\S]*?(?=##|$)/);
  if (codingMatch) sections.push(codingMatch[0].trim());

  const componentMatch = content.match(/## Component Architecture[\s\S]*?(?=##|$)/);
  if (componentMatch) sections.push(componentMatch[0].trim());

  return sections.length > 0 ? sections.join('\n\n') : null;
}

/**
 * Extracts keywords from task description for relevance filtering
 */
function extractTaskKeywords(taskDescription) {
  if (!taskDescription) return [];

  // Extract meaningful words (nouns, component names, etc.)
  const words = taskDescription
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w.toLowerCase());

  // Also extract PascalCase component names
  const pascalCaseNames = taskDescription.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)*/g) || [];

  return [...new Set([...words, ...pascalCaseNames.map(n => n.toLowerCase())])];
}

/**
 * Checks if a type definition is relevant to the task
 */
function isTypeRelevant(typeDefinition, keywords, filename) {
  if (!keywords || keywords.length === 0) return true;

  const typeLower = typeDefinition.toLowerCase();
  const filenameLower = filename.toLowerCase();

  // Always include types that match the filename
  if (typeLower.includes(filenameLower) || filenameLower.includes(typeLower.split(/\s+/)[1]?.toLowerCase() || '')) {
    return true;
  }

  // Check if any keyword appears in the type definition
  return keywords.some(keyword => typeLower.includes(keyword));
}

/**
 * Finds TypeScript types relevant to a file path and task
 * @param {string} projectRoot - Project root directory
 * @param {string} filePath - Target file path
 * @param {Object} options - Options including taskDescription and maxTypes
 */
function loadRelevantTypes(projectRoot, filePath, options = {}) {
  if (!filePath) return null;

  const { taskDescription = '', maxTypes = 5 } = options;
  const keywords = extractTaskKeywords(taskDescription);
  const types = [];
  const dir = path.dirname(filePath);
  const filename = path.basename(filePath, path.extname(filePath));

  // Common type file locations - prioritize closest first
  const typeLocations = [
    path.join(dir, 'types.ts'),
    path.join(dir, 'types.d.ts'),
    path.join(dir, '..', 'types.ts'),
    path.join(dir, '..', 'types', 'index.ts'),
    path.join(dir, '..', 'api', 'types.ts'),
    path.join(projectRoot, 'src', 'types', 'index.ts'),
    path.join(projectRoot, 'src', 'types.ts')
  ];

  for (const typePath of typeLocations) {
    const fullPath = path.isAbsolute(typePath) ? typePath : path.join(projectRoot, typePath);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Extract interface/type definitions (simplified)
        const typeMatches = content.match(/(?:export\s+)?(?:interface|type)\s+\w+[\s\S]*?(?=\n(?:export\s+)?(?:interface|type|const|function)|$)/g);
        if (typeMatches) {
          // Filter types by relevance
          const relevantTypes = typeMatches.filter(t => isTypeRelevant(t, keywords, filename));

          if (relevantTypes.length > 0) {
            types.push(`// From ${path.relative(projectRoot, fullPath)}`);
            types.push(...relevantTypes.slice(0, maxTypes - types.length));
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    // Stop if we have enough types
    if (types.length >= maxTypes) break;
  }

  return types.length > 0 ? types.join('\n\n') : null;
}

/**
 * Finds related code files (similar components, hooks, etc.)
 */
function loadRelatedCode(projectRoot, filePath, stepType) {
  if (!filePath) return null;

  const related = [];
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);

  // Find siblings or similar files
  const searchDirs = [dir, path.join(dir, '..'), path.join(dir, '..', '..')];

  for (const searchDir of searchDirs) {
    const fullSearchDir = path.isAbsolute(searchDir) ? searchDir : path.join(projectRoot, searchDir);
    if (!fs.existsSync(fullSearchDir)) continue;

    try {
      const files = fs.readdirSync(fullSearchDir);

      for (const file of files) {
        if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
        if (file.includes('.test.') || file.includes('.spec.')) continue;

        const fullFilePath = path.join(fullSearchDir, file);
        if (fullFilePath === filePath) continue;

        // Limit to first 2 related files
        if (related.length >= 2) break;

        try {
          const content = fs.readFileSync(fullFilePath, 'utf-8');
          // Take first 50 lines as example
          const preview = content.split('\n').slice(0, 50).join('\n');
          related.push(`// Example from ${path.relative(projectRoot, fullFilePath)}\n${preview}`);
        } catch {
          // Ignore read errors
        }
      }
    } catch {
      // Ignore dir read errors
    }

    if (related.length >= 2) break;
  }

  return related.length > 0 ? related.join('\n\n---\n\n') : null;
}

/**
 * Finds examples of similar implementations
 */
function loadSimilarExamples(projectRoot, stepType) {
  // Map step types to example search patterns
  const patterns = {
    'create-component': ['components/**/*.tsx', 'features/**/components/*.tsx'],
    'create-hook': ['hooks/**/*.ts', 'features/**/hooks/*.ts'],
    'create-service': ['services/**/*.ts', 'api/**/*.ts'],
    'modify-file': [] // No examples needed for modifications
  };

  const searchPatterns = patterns[stepType] || [];
  if (searchPatterns.length === 0) return null;

  // This is a simplified version - in practice, you'd use glob
  // For now, return null and let the orchestrator handle it
  return null;
}

// ============================================================
// Verbosity Guidance
// ============================================================

/**
 * Returns guidance text based on verbosity level
 */
function getVerbosityGuidance(verbosity) {
  const guidance = {
    concise: `
Keep instructions brief. The local LLM just needs the specific change.
- One sentence for what to do
- Essential constraints only
- No examples unless critical`,

    standard: `
Include standard context. The local LLM needs enough to succeed.
- Clear description of the task
- Mention imports, patterns, types needed
- List any constraints or edge cases`,

    detailed: `
Be thorough. Include all context the local LLM needs to succeed first try.
- Show exact import paths and type signatures
- Include existing patterns to follow
- Provide examples of similar code
- List all edge cases and error handling requirements`,

    comprehensive: `
Maximum detail. The local LLM should have complete knowledge to implement
this without guessing anything.
- Include full file contents of related files if helpful
- Show complete type definitions
- Provide multiple examples
- Document all integration points
- Include testing requirements`
  };

  return guidance[verbosity] || guidance.standard;
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  INSTRUCTION_RICHNESS,
  COMPLEXITY_TO_RICHNESS,
  getInstructionRichness,
  getVerbosityGuidance,
  // Context loaders
  loadProjectContext,
  loadPatterns,
  loadRelevantTypes,
  loadRelatedCode,
  loadSimilarExamples
};

// ============================================================
// CLI for testing
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node flow-instruction-richness.js <complexity-level>

Complexity levels: small, medium, large, xl

Examples:
  node flow-instruction-richness.js small
  node flow-instruction-richness.js large
`);
    process.exit(0);
  }

  const level = args[0];
  const richness = getInstructionRichness(level);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('             INSTRUCTION RICHNESS CONFIG');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Complexity Level: ${level.toUpperCase()}`);
  console.log(`Richness Level: ${richness.level.toUpperCase()}`);
  console.log(`\n${richness.description}\n`);

  console.log('───────────────────────────────────────────────────────────');
  console.log('                   SETTINGS');
  console.log('───────────────────────────────────────────────────────────\n');

  console.log(`Claude Token Budget: ~${richness.claudeTokenBudget.toLocaleString()}`);
  console.log(`Template Verbosity: ${richness.templateVerbosity}`);
  console.log('');
  console.log(`Include Project Context: ${richness.includeProjectContext ? '✅ Yes' : '❌ No'}`);
  console.log(`Include Type Definitions: ${richness.includeTypeDefinitions ? '✅ Yes' : '❌ No'}`);
  console.log(`Include Related Code: ${richness.includeRelatedCode ? '✅ Yes' : '❌ No'}`);
  console.log(`Include Examples: ${richness.includeExamples ? '✅ Yes' : '❌ No'}`);
  console.log(`Include Patterns: ${richness.includePatterns ? '✅ Yes' : '❌ No'}`);
  console.log(`Include Full File Contents: ${richness.includeFullFileContents ? '✅ Yes' : '❌ No'}`);

  console.log('\n───────────────────────────────────────────────────────────');
  console.log('                  GUIDANCE');
  console.log('───────────────────────────────────────────────────────────');
  console.log(getVerbosityGuidance(richness.templateVerbosity));

  console.log('\n═══════════════════════════════════════════════════════════\n');
}
