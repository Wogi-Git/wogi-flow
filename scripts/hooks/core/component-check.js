#!/usr/bin/env node

/**
 * Wogi Flow - Component Check (Core Module)
 *
 * CLI-agnostic component reuse detection.
 * Checks if a similar component exists before creating a new one.
 *
 * Returns a standardized result that adapters transform for specific CLIs.
 */

const path = require('path');
const fs = require('fs');

// Import from parent scripts directory
const { getConfig, PATHS } = require('../../flow-utils');

/**
 * Check if component reuse checking is enabled
 * @returns {boolean}
 */
function isComponentCheckEnabled() {
  const config = getConfig();
  return config.hooks?.rules?.componentReuse?.enabled !== false;
}

/**
 * Get component patterns to check
 * @returns {string[]} Glob patterns for component directories
 */
function getComponentPatterns() {
  const config = getConfig();
  return config.hooks?.rules?.componentReuse?.patterns ||
         config.componentRules?.directories ||
         ['**/components/**', '**/ui/**', '**/src/components/**'];
}

/**
 * Get similarity threshold
 * @returns {number} Threshold (0-100)
 */
function getSimilarityThreshold() {
  const config = getConfig();
  return config.hooks?.rules?.componentReuse?.threshold || 80;
}

/**
 * Check if a file path matches component patterns
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
function isComponentPath(filePath) {
  const patterns = getComponentPatterns();
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of patterns) {
    // Simple pattern matching (supports ** and *)
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');

    if (new RegExp(regexPattern).test(normalizedPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Load the component index
 * @returns {Object|null} Component index or null
 */
function loadComponentIndex() {
  try {
    const indexPath = path.join(PATHS.state, 'component-index.json');
    if (!fs.existsSync(indexPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch (err) {
    return null;
  }
}

/**
 * Parse app-map.md for component entries
 * @returns {Array} Component entries from app-map
 */
function parseAppMap() {
  try {
    const appMapPath = PATHS.appMap;
    if (!fs.existsSync(appMapPath)) {
      return [];
    }

    const content = fs.readFileSync(appMapPath, 'utf-8');
    const components = [];

    // Parse markdown table or list entries
    const lines = content.split('\n');
    for (const line of lines) {
      // Match table rows: | ComponentName | description | path |
      const tableMatch = line.match(/^\|\s*([^|]+)\s*\|/);
      if (tableMatch && !tableMatch[1].includes('---')) {
        const name = tableMatch[1].trim();
        if (name && name !== 'Component' && name !== 'Name') {
          components.push({ name, source: 'app-map' });
        }
      }

      // Match list items: - ComponentName: description
      const listMatch = line.match(/^[-*]\s+\*?\*?([A-Z][a-zA-Z0-9]+)\*?\*?/);
      if (listMatch) {
        components.push({ name: listMatch[1], source: 'app-map' });
      }
    }

    return components;
  } catch (err) {
    return [];
  }
}

/**
 * Calculate similarity between two strings (Levenshtein-based)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity score (0-100)
 */
function calculateSimilarity(a, b) {
  if (!a || !b) return 0;

  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 100;

  // Check if one contains the other
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    const longer = Math.max(a.length, b.length);
    const shorter = Math.min(a.length, b.length);
    return Math.round((shorter / longer) * 100);
  }

  // Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (bLower[i - 1] === aLower[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

/**
 * Extract component name from file path
 * @param {string} filePath - File path
 * @returns {string} Extracted component name
 */
function extractComponentName(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));
  // Remove common suffixes
  return fileName
    .replace(/\.(component|view|container|page|screen)$/i, '')
    .replace(/[-_]/g, '');
}

/**
 * Find similar components to a given name
 * @param {string} componentName - Name to search for
 * @returns {Array} Similar components sorted by similarity
 */
function findSimilarComponents(componentName) {
  const threshold = getSimilarityThreshold();
  const similar = [];

  // Check component index
  const index = loadComponentIndex();
  if (index && index.components) {
    for (const comp of index.components) {
      const name = comp.name || extractComponentName(comp.path || '');
      const similarity = calculateSimilarity(componentName, name);
      if (similarity >= threshold) {
        similar.push({
          name,
          path: comp.path,
          similarity,
          source: 'component-index'
        });
      }
    }
  }

  // Check app-map
  const appMapComponents = parseAppMap();
  for (const comp of appMapComponents) {
    const similarity = calculateSimilarity(componentName, comp.name);
    if (similarity >= threshold) {
      // Avoid duplicates
      if (!similar.some(s => s.name === comp.name)) {
        similar.push({
          name: comp.name,
          similarity,
          source: 'app-map'
        });
      }
    }
  }

  // Sort by similarity descending
  return similar.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Check component reuse for a new file
 * @param {Object} options
 * @param {string} options.filePath - Path of new file
 * @param {string} options.content - Content of new file (optional)
 * @returns {Object} Result: { allowed, warning, message, similar }
 */
function checkComponentReuse(options = {}) {
  const { filePath, content } = options;

  if (!isComponentCheckEnabled()) {
    return {
      allowed: true,
      warning: false,
      message: null,
      reason: 'component_check_disabled'
    };
  }

  // Only check component paths
  if (!isComponentPath(filePath)) {
    return {
      allowed: true,
      warning: false,
      message: null,
      reason: 'not_component_path'
    };
  }

  const componentName = extractComponentName(filePath);
  const similar = findSimilarComponents(componentName);

  if (similar.length === 0) {
    return {
      allowed: true,
      warning: false,
      message: null,
      reason: 'no_similar_found'
    };
  }

  // Found similar components
  const config = getConfig();
  const shouldBlock = config.hooks?.rules?.componentReuse?.blockOnSimilar === true;
  const bestMatch = similar[0];

  const message = generateSimilarMessage(componentName, similar);

  if (shouldBlock) {
    return {
      allowed: false,
      warning: false,
      blocked: true,
      message,
      similar,
      bestMatch,
      reason: 'similar_component_exists'
    };
  }

  return {
    allowed: true,
    warning: true,
    message,
    similar,
    bestMatch,
    reason: 'similar_component_warning'
  };
}

/**
 * Generate message about similar components
 */
function generateSimilarMessage(componentName, similar) {
  const bestMatch = similar[0];
  let msg = `Similar component found: ${bestMatch.name} (${bestMatch.similarity}% match)`;

  if (bestMatch.path) {
    msg += ` at ${bestMatch.path}`;
  }

  if (similar.length > 1) {
    msg += `\n\nOther similar components:`;
    for (const s of similar.slice(1, 4)) {
      msg += `\n- ${s.name} (${s.similarity}%)`;
      if (s.path) msg += ` at ${s.path}`;
    }
  }

  msg += `\n\nConsider:`;
  msg += `\n1. Using the existing component`;
  msg += `\n2. Adding a variant to the existing component`;
  msg += `\n3. Extending the existing component`;

  return msg;
}

module.exports = {
  isComponentCheckEnabled,
  getComponentPatterns,
  getSimilarityThreshold,
  isComponentPath,
  loadComponentIndex,
  parseAppMap,
  calculateSimilarity,
  extractComponentName,
  findSimilarComponents,
  checkComponentReuse,
  generateSimilarMessage
};
