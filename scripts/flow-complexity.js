#!/usr/bin/env node

/**
 * Wogi Flow - Task Complexity Assessment
 *
 * Analyzes task complexity to estimate appropriate token budget for hybrid mode.
 * Local LLM tokens are free, but right-sizing helps:
 * - Simple tasks: Faster execution, less context noise
 * - Complex tasks: Enough context to succeed without escalation
 *
 * Usage:
 *   const { assessTaskComplexity, TOKEN_BUDGETS } = require('./flow-complexity');
 *   const complexity = assessTaskComplexity(task);
 */

// ============================================================
// Token Budget Tiers
// ============================================================

const TOKEN_BUDGETS = {
  small: {
    min: 1000,
    default: 1500,
    max: 2000,
    description: 'Single file, simple change, no new dependencies'
  },
  medium: {
    min: 2000,
    default: 3000,
    max: 4000,
    description: 'Multi-file changes, moderate complexity, some boilerplate'
  },
  large: {
    min: 4000,
    default: 5000,
    max: 6000,
    description: 'Many files, complex logic, tests, error handling'
  },
  xl: {
    min: 6000,
    default: 7000,
    max: 8000,
    description: 'Architectural changes, many dependencies, extensive boilerplate'
  }
};

// ============================================================
// Complexity Keywords and Weights
// ============================================================

/**
 * Keywords that indicate higher complexity
 * Each keyword adds to the complexity score
 */
const COMPLEXITY_KEYWORDS = {
  // High complexity (weight: 3)
  high: [
    'refactor', 'migrate', 'authentication', 'authorization', 'auth',
    'security', 'encryption', 'database', 'migration', 'schema',
    'integration', 'api', 'websocket', 'realtime', 'cache', 'caching',
    'payment', 'stripe', 'checkout', 'transaction'
  ],
  // Medium complexity (weight: 2)
  medium: [
    'validation', 'form', 'crud', 'create', 'update', 'delete',
    'filter', 'sort', 'pagination', 'search', 'modal', 'dialog',
    'notification', 'toast', 'error handling', 'loading', 'state',
    'hook', 'context', 'provider', 'service'
  ],
  // Low complexity (weight: 1)
  low: [
    'style', 'css', 'color', 'margin', 'padding', 'layout',
    'text', 'label', 'button', 'icon', 'image', 'link',
    'import', 'export', 'rename', 'move', 'typo', 'fix'
  ]
};

/**
 * Keywords that indicate simple/small tasks
 */
const SIMPLICITY_KEYWORDS = [
  'simple', 'quick', 'small', 'minor', 'typo', 'rename',
  'comment', 'log', 'console', 'debug', 'cleanup', 'remove unused'
];

/**
 * Keywords indicating test requirements
 */
const TEST_KEYWORDS = [
  'test', 'spec', 'unit test', 'integration test', 'e2e',
  'coverage', 'mock', 'stub', 'fixture'
];

// ============================================================
// Complexity Assessment Functions
// ============================================================

/**
 * Counts file references in task description
 * @param {string} text - Task description or criteria
 * @returns {Object} - File count metrics
 */
function countFileReferences(text) {
  if (!text) return { total: 0, create: 0, modify: 0 };

  const lowerText = text.toLowerCase();

  // Count explicit file mentions
  const filePatterns = [
    /\b\w+\.(tsx?|jsx?|ts|js|css|scss|json|md)\b/gi,
    /create\s+(?:a\s+)?(?:new\s+)?(\w+)\s+(?:file|component|service|hook)/gi,
    /modify\s+(?:the\s+)?(\w+)/gi,
    /update\s+(?:the\s+)?(\w+)/gi,
    /add\s+to\s+(\w+)/gi
  ];

  let fileCount = 0;
  for (const pattern of filePatterns) {
    const matches = text.match(pattern);
    if (matches) fileCount += matches.length;
  }

  // Estimate create vs modify
  const createKeywords = ['create', 'new', 'add', 'implement', 'build'];
  const modifyKeywords = ['update', 'modify', 'change', 'fix', 'edit', 'refactor'];

  const hasCreate = createKeywords.some(k => lowerText.includes(k));
  const hasModify = modifyKeywords.some(k => lowerText.includes(k));

  // Minimum 1 file if task exists
  const total = Math.max(1, fileCount);

  return {
    total,
    create: hasCreate ? Math.ceil(total * 0.6) : 0,
    modify: hasModify ? Math.ceil(total * 0.4) : total
  };
}

/**
 * Detects complexity keywords in text
 * @param {string} text - Task description
 * @returns {Object} - Detected keywords by weight
 */
function detectComplexityKeywords(text) {
  if (!text) return { high: [], medium: [], low: [], simplicity: [] };

  const lowerText = text.toLowerCase();

  const detected = {
    high: COMPLEXITY_KEYWORDS.high.filter(k => lowerText.includes(k)),
    medium: COMPLEXITY_KEYWORDS.medium.filter(k => lowerText.includes(k)),
    low: COMPLEXITY_KEYWORDS.low.filter(k => lowerText.includes(k)),
    simplicity: SIMPLICITY_KEYWORDS.filter(k => lowerText.includes(k))
  };

  return detected;
}

/**
 * Checks if tests are required
 * @param {string} text - Task description
 * @returns {boolean}
 */
function requiresTests(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return TEST_KEYWORDS.some(k => lowerText.includes(k));
}

/**
 * Counts acceptance criteria/scenarios
 * @param {Object} task - Task object
 * @returns {number}
 */
function countAcceptanceCriteria(task) {
  let count = 0;

  // Check for scenarios in task
  if (task.scenarios) {
    count += Array.isArray(task.scenarios) ? task.scenarios.length : 1;
  }

  // Check for acceptance criteria
  if (task.acceptanceCriteria) {
    if (Array.isArray(task.acceptanceCriteria)) {
      count += task.acceptanceCriteria.length;
    } else if (typeof task.acceptanceCriteria === 'string') {
      // Count Given/When/Then blocks
      const givenMatches = task.acceptanceCriteria.match(/given\b/gi);
      count += givenMatches ? givenMatches.length : 1;
    }
  }

  // Check description for scenario patterns
  const description = task.description || task.title || '';
  const scenarioMatches = description.match(/scenario\s*\d*:|given\s|when\s|then\s/gi);
  if (scenarioMatches) {
    count += Math.ceil(scenarioMatches.length / 3); // Given/When/Then = 1 scenario
  }

  return count || 1; // Minimum 1
}

/**
 * Calculates complexity score and estimates tokens
 * @param {Object} factors - Complexity factors
 * @returns {Object} - Score and token estimate
 */
function calculateComplexityScore(factors) {
  let score = 0;
  const breakdown = [];

  // Base score
  score += 1000;
  breakdown.push('Base: 1000');

  // File-based scoring
  if (factors.fileCount.create > 0) {
    const createTokens = factors.fileCount.create * 800;
    score += createTokens;
    breakdown.push(`Create ${factors.fileCount.create} files: +${createTokens}`);
  }

  if (factors.fileCount.modify > 0) {
    const modifyTokens = factors.fileCount.modify * 400;
    score += modifyTokens;
    breakdown.push(`Modify ${factors.fileCount.modify} files: +${modifyTokens}`);
  }

  // Keyword-based scoring
  if (factors.keywords.high.length > 0) {
    const highTokens = factors.keywords.high.length * 500;
    score += highTokens;
    breakdown.push(`High complexity keywords (${factors.keywords.high.join(', ')}): +${highTokens}`);
  }

  if (factors.keywords.medium.length > 0) {
    const medTokens = factors.keywords.medium.length * 300;
    score += medTokens;
    breakdown.push(`Medium complexity keywords: +${medTokens}`);
  }

  // Tests
  if (factors.hasTests) {
    score += 1000;
    breakdown.push('Tests required: +1000');
  }

  // Acceptance criteria complexity
  if (factors.acceptanceCriteriaCount > 3) {
    const acTokens = (factors.acceptanceCriteriaCount - 3) * 200;
    score += acTokens;
    breakdown.push(`Extra acceptance criteria: +${acTokens}`);
  }

  // Simplicity discount
  if (factors.keywords.simplicity.length > 0 && score > 1500) {
    const discount = Math.min(500, factors.keywords.simplicity.length * 200);
    score -= discount;
    breakdown.push(`Simplicity discount: -${discount}`);
  }

  return { score, breakdown };
}

/**
 * Determines complexity level from score
 * @param {number} score - Calculated score
 * @returns {string} - Complexity level
 */
function scoreToLevel(score) {
  if (score <= TOKEN_BUDGETS.small.max) return 'small';
  if (score <= TOKEN_BUDGETS.medium.max) return 'medium';
  if (score <= TOKEN_BUDGETS.large.max) return 'large';
  return 'xl';
}

/**
 * Main function: Assess task complexity
 *
 * @param {Object} task - Task object with description, title, acceptanceCriteria, etc.
 * @returns {Object} - Complexity assessment
 */
function assessTaskComplexity(task) {
  // Handle string input (just a description)
  if (typeof task === 'string') {
    task = { description: task };
  }

  // Combine all text sources for analysis
  const textSources = [
    task.title,
    task.description,
    task.summary,
    Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria.join(' ') : task.acceptanceCriteria,
    task.technicalNotes,
    task.notes
  ].filter(Boolean).join(' ');

  // Gather factors
  const factors = {
    fileCount: countFileReferences(textSources),
    keywords: detectComplexityKeywords(textSources),
    hasTests: requiresTests(textSources),
    acceptanceCriteriaCount: countAcceptanceCriteria(task),
    hasDependencies: /depend|require|need|import from|install/i.test(textSources)
  };

  // Calculate score
  const { score, breakdown } = calculateComplexityScore(factors);

  // Determine level
  const level = scoreToLevel(score);
  const budget = TOKEN_BUDGETS[level];

  // Clamp to budget range
  const estimatedTokens = Math.max(budget.min, Math.min(budget.max, score));

  // Generate reasoning
  const reasoning = generateReasoning(level, factors, breakdown);

  return {
    level,
    estimatedTokens,
    reasoning,
    factors: {
      fileCount: factors.fileCount.total,
      filesToCreate: factors.fileCount.create,
      filesToModify: factors.fileCount.modify,
      hasTests: factors.hasTests,
      hasDependencies: factors.hasDependencies,
      acceptanceCriteriaCount: factors.acceptanceCriteriaCount,
      complexityKeywords: [...factors.keywords.high, ...factors.keywords.medium],
      simplicityKeywords: factors.keywords.simplicity
    },
    budget,
    scoreBreakdown: breakdown
  };
}

/**
 * Generates human-readable reasoning
 */
function generateReasoning(level, factors, breakdown) {
  const parts = [];

  // File summary
  if (factors.fileCount.create > 0 && factors.fileCount.modify > 0) {
    parts.push(`Creating ${factors.fileCount.create} and modifying ${factors.fileCount.modify} files`);
  } else if (factors.fileCount.create > 0) {
    parts.push(`Creating ${factors.fileCount.create} new file(s)`);
  } else if (factors.fileCount.modify > 0) {
    parts.push(`Modifying ${factors.fileCount.modify} file(s)`);
  }

  // Complexity keywords
  if (factors.keywords.high.length > 0) {
    parts.push(`High complexity: ${factors.keywords.high.slice(0, 3).join(', ')}`);
  }

  // Tests
  if (factors.hasTests) {
    parts.push('Tests required');
  }

  // Dependencies
  if (factors.hasDependencies) {
    parts.push('Has dependencies');
  }

  return parts.length > 0 ? parts.join('. ') + '.' : TOKEN_BUDGETS[level].description;
}

/**
 * Gets the default token budget for a level
 */
function getDefaultTokens(level) {
  return TOKEN_BUDGETS[level]?.default || TOKEN_BUDGETS.medium.default;
}

/**
 * Validates and clamps a token estimate to valid range
 */
function clampTokens(tokens, minTokens = 1000, maxTokens = 8000) {
  return Math.max(minTokens, Math.min(maxTokens, tokens));
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  assessTaskComplexity,
  TOKEN_BUDGETS,
  COMPLEXITY_KEYWORDS,
  SIMPLICITY_KEYWORDS,
  TEST_KEYWORDS,
  getDefaultTokens,
  clampTokens,
  // Expose internal functions for testing
  countFileReferences,
  detectComplexityKeywords,
  requiresTests,
  countAcceptanceCriteria,
  calculateComplexityScore,
  scoreToLevel
};

// ============================================================
// CLI for testing
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: node flow-complexity.js "<task description>"

Examples:
  node flow-complexity.js "Add a console.log to the login function"
  node flow-complexity.js "Create a new UserProfile component with tests"
  node flow-complexity.js "Implement role-based access control for all API endpoints"
`);
    process.exit(0);
  }

  const taskDescription = args.join(' ');
  const result = assessTaskComplexity(taskDescription);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                TASK COMPLEXITY ASSESSMENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Task: "${taskDescription}"\n`);

  console.log(`Level: ${result.level.toUpperCase()}`);
  console.log(`Estimated Tokens: ${result.estimatedTokens.toLocaleString()}`);
  console.log(`Budget Range: ${result.budget.min.toLocaleString()} - ${result.budget.max.toLocaleString()}`);
  console.log(`\nReasoning: ${result.reasoning}`);

  console.log('\n───────────────────────────────────────────────────────────');
  console.log('                      FACTORS');
  console.log('───────────────────────────────────────────────────────────\n');

  console.log(`Files to create: ${result.factors.filesToCreate}`);
  console.log(`Files to modify: ${result.factors.filesToModify}`);
  console.log(`Has tests: ${result.factors.hasTests}`);
  console.log(`Has dependencies: ${result.factors.hasDependencies}`);
  console.log(`Acceptance criteria: ${result.factors.acceptanceCriteriaCount}`);

  if (result.factors.complexityKeywords.length > 0) {
    console.log(`Complexity keywords: ${result.factors.complexityKeywords.join(', ')}`);
  }

  if (result.factors.simplicityKeywords.length > 0) {
    console.log(`Simplicity keywords: ${result.factors.simplicityKeywords.join(', ')}`);
  }

  console.log('\n───────────────────────────────────────────────────────────');
  console.log('                  SCORE BREAKDOWN');
  console.log('───────────────────────────────────────────────────────────\n');

  for (const item of result.scoreBreakdown) {
    console.log(`  ${item}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}
