#!/usr/bin/env node

/**
 * Wogi Flow - Instruction Richness Module
 *
 * Controls how much detail to include for the local LLM.
 *
 * KEY INSIGHT: Local LLM tokens are FREE. The goal is to give the LLM
 * everything it needs for 90%+ success rate. Failed executions cost more
 * (in Claude retry tokens) than generous upfront context.
 *
 * This module provides GUIDANCE on context richness, not hard limits.
 * When in doubt, include MORE context - it's free for the local LLM!
 *
 * Usage:
 *   const { getInstructionRichness } = require('./flow-instruction-richness');
 *   const richness = getInstructionRichness('large');
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// Instruction Richness Levels (Guidance, NOT Limits)
// ============================================================

/**
 * Richness levels guide what context to include for the local LLM.
 *
 * IMPORTANT: These are MINIMUMS for each complexity level.
 * Always include MORE context if there's any doubt - local LLM tokens are free!
 *
 * The goal is 90%+ success rate, not minimizing tokens.
 */
const INSTRUCTION_RICHNESS = {
  minimal: {
    // Even "minimal" should include enough for success
    includeProjectContext: true,  // Always include
    includeTypeDefinitions: true, // Always include - prevents type errors
    includeRelatedCode: false,
    includeExamples: false,
    includePatterns: true,        // Always include - consistency matters
    includeFullFileContents: false,
    templateVerbosity: 'standard', // Upgraded from 'concise'
    description: 'Simple changes - but still include types and patterns for accuracy'
  },

  standard: {
    includeProjectContext: true,
    includeTypeDefinitions: true,
    includeRelatedCode: true,     // Include related code for context
    includeExamples: true,        // Include examples - they help!
    includePatterns: true,
    includeFullFileContents: false,
    templateVerbosity: 'detailed', // Upgraded from 'standard'
    description: 'Typical tasks - include examples and related code for best results'
  },

  rich: {
    includeProjectContext: true,
    includeTypeDefinitions: true,
    includeRelatedCode: true,
    includeExamples: true,
    includePatterns: true,
    includeFullFileContents: true, // Include full files for complex tasks
    templateVerbosity: 'comprehensive',
    description: 'Complex tasks - full context for highest success rate'
  },

  maximum: {
    includeProjectContext: true,
    includeTypeDefinitions: true,
    includeRelatedCode: true,
    includeExamples: true,
    includePatterns: true,
    includeFullFileContents: true,
    templateVerbosity: 'comprehensive',
    description: 'XL tasks - everything available, maximum context'
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
 * Simple glob pattern matcher for finding example files
 */
function globSync(basePath, pattern) {
  const results = [];
  const parts = pattern.split('/');

  const searchDir = (currentPath, remainingParts) => {
    if (remainingParts.length === 0) {
      if (fs.existsSync(currentPath) && fs.statSync(currentPath).isFile()) {
        results.push(currentPath);
      }
      return;
    }

    const [current, ...rest] = remainingParts;

    if (current === '**') {
      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          if (entry.isDirectory()) {
            // Continue with ** (recurse deeper)
            searchDir(fullPath, remainingParts);
            // Also try without ** (match at this level)
            searchDir(fullPath, rest);
          } else if (rest.length === 0) {
            results.push(fullPath);
          } else if (rest.length === 1 && matchGlobPart(entry.name, rest[0])) {
            results.push(fullPath);
          }
        }
      } catch { /* ignore permission errors */ }
    } else if (current.includes('*')) {
      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          if (matchGlobPart(entry.name, current)) {
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
              searchDir(fullPath, rest);
            } else if (rest.length === 0) {
              results.push(fullPath);
            }
          }
        }
      } catch { /* ignore permission errors */ }
    } else {
      const nextPath = path.join(currentPath, current);
      if (fs.existsSync(nextPath)) {
        searchDir(nextPath, rest);
      }
    }
  };

  // Handle src/ prefix - check both with and without
  const srcPath = path.join(basePath, 'src');
  if (fs.existsSync(srcPath)) {
    searchDir(srcPath, parts);
  }
  searchDir(basePath, parts);

  return [...new Set(results)]; // Dedupe
}

/**
 * Match a filename against a glob pattern part (e.g., *.tsx)
 */
function matchGlobPart(filename, pattern) {
  const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  return regex.test(filename);
}

/**
 * Truncate file content to a reasonable size for examples
 */
function truncateForExample(content, maxLines = 60) {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;

  // Keep imports and first part of file
  const imports = [];
  let importEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ') || lines[i].startsWith('from ') || lines[i].trim() === '') {
      imports.push(lines[i]);
      importEnd = i + 1;
    } else if (imports.length > 0) {
      break;
    }
  }

  const remaining = maxLines - imports.length - 3;
  const body = lines.slice(importEnd, importEnd + remaining);

  return [
    ...imports,
    ...body,
    '',
    `// ... (${lines.length - importEnd - remaining} more lines truncated)`,
    ''
  ].join('\n');
}

/**
 * Finds examples of similar implementations
 */
function loadSimilarExamples(projectRoot, stepType, maxExamples = 2) {
  // Map step types to example search patterns
  const patterns = {
    'create-component': [
      'components/**/*.tsx',
      'features/**/components/*.tsx',
      'app/**/components/*.tsx',
      'ui/**/*.tsx'
    ],
    'create-hook': [
      'hooks/**/*.ts',
      'hooks/**/*.tsx',
      'features/**/hooks/*.ts',
      'lib/hooks/*.ts'
    ],
    'create-service': [
      'services/**/*.ts',
      'api/**/*.ts',
      'lib/api/*.ts',
      'features/**/api/*.ts'
    ],
    'create-util': [
      'utils/**/*.ts',
      'lib/**/*.ts',
      'helpers/**/*.ts'
    ],
    'create-test': [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '__tests__/**/*.ts'
    ],
    'modify-file': [] // No examples needed for modifications
  };

  const searchPatterns = patterns[stepType] || patterns['create-component'];
  if (searchPatterns.length === 0) return null;

  const examples = [];
  const seen = new Set();

  for (const pattern of searchPatterns) {
    if (examples.length >= maxExamples) break;

    const files = globSync(projectRoot, pattern);

    // Sort by file size (prefer smaller, simpler examples)
    const sorted = files
      .map(f => ({ path: f, size: fs.statSync(f).size }))
      .sort((a, b) => a.size - b.size)
      .slice(0, 5); // Consider top 5 smallest

    for (const { path: filePath } of sorted) {
      if (examples.length >= maxExamples) break;
      if (seen.has(filePath)) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Skip files that are too short (likely stubs) or too long
        const lineCount = content.split('\n').length;
        if (lineCount < 10 || lineCount > 500) continue;

        seen.add(filePath);
        const relativePath = path.relative(projectRoot, filePath);
        const truncated = truncateForExample(content);

        examples.push(`### Example: ${relativePath}\n\`\`\`typescript\n${truncated}\`\`\``);
      } catch { /* ignore read errors */ }
    }
  }

  if (examples.length === 0) return null;

  return `## Similar Examples in This Project\n\nUse these as reference for style and patterns:\n\n${examples.join('\n\n')}`;
}

// ============================================================
// Verbosity Guidance
// ============================================================

/**
 * Returns guidance text based on verbosity level
 *
 * NOTE: All levels now emphasize completeness over brevity.
 * Local LLM tokens are free - include everything needed for success!
 */
function getVerbosityGuidance(verbosity) {
  const guidance = {
    standard: `
Include enough context for success. Local LLM tokens are free!
- Clear description of the task
- All imports with exact paths
- Type definitions for all interfaces
- Mention patterns to follow`,

    detailed: `
Be thorough. Include everything the local LLM needs to succeed first try.
- Show exact import paths and type signatures
- Include ALL props for components being used
- Show existing patterns to follow
- Provide examples of similar code
- List all edge cases and error handling requirements`,

    comprehensive: `
Maximum detail. The local LLM should have complete knowledge to implement
this without guessing anything. Local LLM tokens are FREE - don't hold back!
- Include full file contents of related files
- Show complete type definitions with all fields
- Provide multiple usage examples
- Document all integration points
- Include testing requirements
- Show exact prop values (variant="primary" not variant={variants.primary})`
  };

  return guidance[verbosity] || guidance.detailed;
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
  console.log('     INSTRUCTION RICHNESS CONFIG (Local LLM is FREE!)');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Complexity Level: ${level.toUpperCase()}`);
  console.log(`Richness Level: ${richness.level.toUpperCase()}`);
  console.log(`\n${richness.description}\n`);

  console.log('───────────────────────────────────────────────────────────');
  console.log('              CONTEXT TO INCLUDE');
  console.log('───────────────────────────────────────────────────────────\n');

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

  console.log('\n💡 Remember: Local LLM tokens are FREE! Include MORE context');
  console.log('   when in doubt. Failed executions cost more than extra context.\n');
  console.log('═══════════════════════════════════════════════════════════\n');
}
