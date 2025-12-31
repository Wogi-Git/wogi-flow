#!/usr/bin/env node

/**
 * Wogi Flow - Export Scanner
 *
 * Scans TypeScript/JavaScript files for exports to build an accurate
 * import map for the local LLM. This ensures the LLM only uses imports
 * that actually exist in the project.
 *
 * Usage:
 *   node flow-export-scanner.js [project-root]
 *   node flow-export-scanner.js --cache  # Use cached export map if fresh
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : process.cwd();
const CONFIG_PATH = path.join(PROJECT_ROOT, '.workflow/config.json');
const CACHE_PATH = path.join(PROJECT_ROOT, '.workflow/state/export-map.json');
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================
// Export Extraction
// ============================================================

/**
 * Extract exports from a TypeScript/JavaScript file
 * @param {string} filePath - Path to the file
 * @returns {{ namedExports: string[], defaultExport: string|null, types: string[] }}
 */
function extractExports(filePath) {
  const result = {
    namedExports: [],
    defaultExport: null,
    types: []
  };

  if (!fs.existsSync(filePath)) return result;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Match export { X, Y, Z } and export { X as Y }
    const reExportMatches = content.matchAll(/export\s+\{\s*([^}]+)\s*\}/g);
    for (const match of reExportMatches) {
      const exports = match[1].split(',').map(e => {
        const parts = e.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim(); // Use the aliased name if exists
      }).filter(e => e && !e.startsWith('type '));
      result.namedExports.push(...exports);
    }

    // Match export type { X, Y }
    const typeExportMatches = content.matchAll(/export\s+type\s+\{\s*([^}]+)\s*\}/g);
    for (const match of typeExportMatches) {
      const types = match[1].split(',').map(e => e.trim().split(/\s+as\s+/).pop().trim());
      result.types.push(...types);
    }

    // Match export const/function/class X
    const namedExportMatches = content.matchAll(/export\s+(?:const|let|var|function|class)\s+(\w+)/g);
    for (const match of namedExportMatches) {
      if (!result.namedExports.includes(match[1])) {
        result.namedExports.push(match[1]);
      }
    }

    // Match export type/interface X
    const typeDefMatches = content.matchAll(/export\s+(?:type|interface)\s+(\w+)/g);
    for (const match of typeDefMatches) {
      if (!result.types.includes(match[1])) {
        result.types.push(match[1]);
      }
    }

    // Match export default X or export default function X
    const defaultMatch = content.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (defaultMatch) {
      result.defaultExport = defaultMatch[1];
    }

    // Also check for "export default" at end of file (common pattern)
    const defaultAtEnd = content.match(/export\s+default\s+(\w+)\s*;?\s*$/m);
    if (defaultAtEnd && !result.defaultExport) {
      result.defaultExport = defaultAtEnd[1];
    }

  } catch (e) {
    // Ignore read errors
  }

  return result;
}

/**
 * Scan a component/module directory for exports and resolve import path
 * @param {string} dirPath - Full path to the component directory
 * @param {string} baseImportPath - Base import path (e.g., '@/components')
 * @returns {{ exports: string[], types: string[], importPath: string, defaultExport: string|null }|null}
 */
function scanModuleExports(dirPath, baseImportPath) {
  const dirName = path.basename(dirPath);

  // Check for index file first
  const indexFiles = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];
  let mainFile = null;

  for (const indexFile of indexFiles) {
    const indexPath = path.join(dirPath, indexFile);
    if (fs.existsSync(indexPath)) {
      mainFile = indexPath;
      break;
    }
  }

  // If no index, try [DirName].tsx pattern
  if (!mainFile) {
    const componentFiles = [`${dirName}.tsx`, `${dirName}.ts`, `${dirName}.jsx`, `${dirName}.js`];
    for (const compFile of componentFiles) {
      const compPath = path.join(dirPath, compFile);
      if (fs.existsSync(compPath)) {
        mainFile = compPath;
        break;
      }
    }
  }

  if (!mainFile) return null;

  const result = extractExports(mainFile);

  return {
    exports: [...new Set(result.namedExports)],
    types: [...new Set(result.types)],
    defaultExport: result.defaultExport,
    importPath: `${baseImportPath}/${dirName}`
  };
}

/**
 * Scan a single file (not a directory) for exports
 * @param {string} filePath - Full path to the file
 * @param {string} baseImportPath - Base import path
 * @returns {{ exports: string[], types: string[], importPath: string, defaultExport: string|null }|null}
 */
function scanFileExports(filePath, baseImportPath) {
  if (!fs.existsSync(filePath)) return null;

  const fileName = path.basename(filePath);
  const fileNameWithoutExt = fileName.replace(/\.(tsx?|jsx?)$/, '');

  const result = extractExports(filePath);

  return {
    exports: [...new Set(result.namedExports)],
    types: [...new Set(result.types)],
    defaultExport: result.defaultExport,
    importPath: `${baseImportPath}/${fileNameWithoutExt}`
  };
}

// ============================================================
// Export Map Building
// ============================================================

/**
 * Build export map for all configured directories
 * @param {object} config - Project config
 * @returns {object} Export map with components, hooks, types, etc.
 */
function buildExportMap(config) {
  const projectContext = config.hybrid?.projectContext || {};
  const exportMap = {
    components: {},
    hooks: {},
    services: {},
    types: {},
    utils: {},
    _meta: {
      generatedAt: new Date().toISOString(),
      projectRoot: PROJECT_ROOT
    }
  };

  // Scan component directories
  const componentDirs = projectContext.componentDirs || ['src/components'];
  for (const dir of componentDirs) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;

    scanDirectory(fullDir, '@/components', exportMap.components);
  }

  // Scan hooks directory
  const hooksDirs = ['src/hooks', 'hooks'];
  for (const dir of hooksDirs) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;

    // Hooks can be individual files or directories
    scanDirectoryFlat(fullDir, '@/hooks', exportMap.hooks);
  }

  // Scan services directory
  const servicesDirs = ['src/services', 'services', 'src/lib'];
  for (const dir of servicesDirs) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;

    scanDirectoryFlat(fullDir, dir.startsWith('src/') ? `@/${dir.replace('src/', '')}` : `@/${dir}`, exportMap.services);
  }

  // Scan type directories
  const typeDirs = projectContext.typeDirs || ['src/types'];
  for (const dir of typeDirs) {
    // Handle glob patterns like src/types/*.ts
    if (dir.includes('*')) {
      const baseDir = dir.split('*')[0].replace(/\/$/, '');
      const fullDir = path.join(PROJECT_ROOT, baseDir);
      if (!fs.existsSync(fullDir)) continue;

      scanDirectoryFlat(fullDir, '@/types', exportMap.types, true);
    } else {
      const fullDir = path.join(PROJECT_ROOT, dir);
      if (!fs.existsSync(fullDir)) continue;

      scanDirectoryFlat(fullDir, '@/types', exportMap.types, true);
    }
  }

  // Scan utils directory
  const utilsDirs = ['src/utils', 'src/lib/utils', 'utils'];
  for (const dir of utilsDirs) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;

    scanDirectoryFlat(fullDir, dir.startsWith('src/') ? `@/${dir.replace('src/', '')}` : `@/${dir}`, exportMap.utils);
  }

  return exportMap;
}

/**
 * Scan a directory containing subdirectories (like src/components/)
 */
function scanDirectory(dirPath, baseImportPath, target) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Skip common excluded directories
      if (['__tests__', '__mocks__', 'node_modules', '.git'].includes(entry.name)) continue;

      const modulePath = path.join(dirPath, entry.name);
      const result = scanModuleExports(modulePath, baseImportPath);

      if (result && (result.exports.length > 0 || result.defaultExport)) {
        target[entry.name] = result;
      }
    }
  } catch (e) {
    // Ignore scan errors
  }
}

/**
 * Scan a directory containing files (like src/hooks/)
 */
function scanDirectoryFlat(dirPath, baseImportPath, target, typesOnly = false) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip test files and common excludes
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      if (entry.name.includes('.stories.')) continue;
      if (entry.name === 'index.ts' || entry.name === 'index.js') continue;

      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        const result = scanModuleExports(entryPath, baseImportPath);
        if (result && (result.exports.length > 0 || result.defaultExport || result.types.length > 0)) {
          target[entry.name] = result;
        }
      } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        const result = scanFileExports(entryPath, baseImportPath);
        if (result) {
          const key = entry.name.replace(/\.(tsx?|jsx?)$/, '');
          if (typesOnly) {
            if (result.types.length > 0) {
              target[key] = result;
            }
          } else if (result.exports.length > 0 || result.defaultExport) {
            target[key] = result;
          }
        }
      }
    }
  } catch (e) {
    // Ignore scan errors
  }
}

// ============================================================
// Caching
// ============================================================

/**
 * Load cached export map if it's fresh
 * @returns {object|null} Cached export map or null
 */
function loadCachedExportMap() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;

    const stat = fs.statSync(CACHE_PATH);
    const age = Date.now() - stat.mtimeMs;

    if (age > CACHE_MAX_AGE_MS) return null;

    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Save export map to cache
 * @param {object} exportMap - Export map to cache
 */
function saveExportMapCache(exportMap) {
  try {
    const stateDir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(exportMap, null, 2));
  } catch (e) {
    console.error(`Warning: Could not cache export map: ${e.message}`);
  }
}

/**
 * Clear the export map cache
 */
function clearCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      fs.unlinkSync(CACHE_PATH);
      console.log('✓ Cleared export map cache');
    }
  } catch (e) {
    console.error(`Warning: Could not clear cache: ${e.message}`);
  }
}

// ============================================================
// Formatting for Templates
// ============================================================

/**
 * Format export map as markdown for templates
 * @param {object} exportMap - Export map
 * @returns {string} Markdown-formatted export list
 */
function formatExportMapForTemplate(exportMap) {
  const lines = [];

  // Components
  if (Object.keys(exportMap.components).length > 0) {
    lines.push('#### Components');
    for (const [name, info] of Object.entries(exportMap.components)) {
      const exports = info.exports.join(', ') || (info.defaultExport ? `default: ${info.defaultExport}` : '');
      if (exports) {
        lines.push(`- \`import { ${info.exports.join(', ')} } from '${info.importPath}'\``);
      }
    }
    lines.push('');
  }

  // Hooks
  if (Object.keys(exportMap.hooks).length > 0) {
    lines.push('#### Hooks');
    for (const [name, info] of Object.entries(exportMap.hooks)) {
      const exports = info.exports.join(', ');
      if (exports) {
        lines.push(`- \`import { ${exports} } from '${info.importPath}'\``);
      }
    }
    lines.push('');
  }

  // Services
  if (Object.keys(exportMap.services).length > 0) {
    lines.push('#### Services');
    for (const [name, info] of Object.entries(exportMap.services)) {
      const exports = info.exports.join(', ');
      if (exports) {
        lines.push(`- \`import { ${exports} } from '${info.importPath}'\``);
      }
    }
    lines.push('');
  }

  // Types
  if (Object.keys(exportMap.types).length > 0) {
    lines.push('#### Types');
    for (const [name, info] of Object.entries(exportMap.types)) {
      const types = info.types.join(', ');
      if (types) {
        lines.push(`- \`import type { ${types} } from '${info.importPath}'\``);
      }
    }
    lines.push('');
  }

  // Utils
  if (Object.keys(exportMap.utils).length > 0) {
    lines.push('#### Utilities');
    for (const [name, info] of Object.entries(exportMap.utils)) {
      const exports = info.exports.join(', ');
      if (exports) {
        lines.push(`- \`import { ${exports} } from '${info.importPath}'\``);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// CLI
// ============================================================

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { hybrid: { projectContext: {} } };
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function printUsage() {
  console.log(`
Wogi Flow - Export Scanner

Scans your project for TypeScript/JavaScript exports to build an accurate
import map for the local LLM. This ensures generated code uses only valid imports.

Usage:
  node flow-export-scanner.js [project-root]
  node flow-export-scanner.js --cache     # Use cached map if fresh (5 min)
  node flow-export-scanner.js --clear     # Clear the cache
  node flow-export-scanner.js --format    # Output formatted for templates

Output is saved to: .workflow/state/export-map.json
`);
}

// Main
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  if (process.argv.includes('--clear')) {
    clearCache();
    process.exit(0);
  }

  const useCache = process.argv.includes('--cache');
  const formatOutput = process.argv.includes('--format');

  let exportMap;

  if (useCache) {
    exportMap = loadCachedExportMap();
    if (exportMap) {
      console.log('Using cached export map');
    }
  }

  if (!exportMap) {
    console.log('Scanning project exports...\n');
    const config = loadConfig();
    exportMap = buildExportMap(config);
    saveExportMapCache(exportMap);
  }

  // Report findings
  const componentCount = Object.keys(exportMap.components).length;
  const hookCount = Object.keys(exportMap.hooks).length;
  const serviceCount = Object.keys(exportMap.services).length;
  const typeCount = Object.keys(exportMap.types).length;
  const utilCount = Object.keys(exportMap.utils).length;

  console.log(`Found exports:`);
  console.log(`  Components: ${componentCount}`);
  console.log(`  Hooks: ${hookCount}`);
  console.log(`  Services: ${serviceCount}`);
  console.log(`  Types: ${typeCount}`);
  console.log(`  Utils: ${utilCount}`);

  if (formatOutput) {
    console.log('\n--- Template Format ---\n');
    console.log(formatExportMapForTemplate(exportMap));
  }

  console.log(`\n✓ Export map saved to ${CACHE_PATH}`);
}

module.exports = {
  extractExports,
  scanModuleExports,
  scanFileExports,
  buildExportMap,
  loadCachedExportMap,
  saveExportMapCache,
  clearCache,
  formatExportMapForTemplate
};
