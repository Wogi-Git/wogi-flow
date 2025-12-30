#!/usr/bin/env node

/**
 * Wogi Flow - Hybrid Mode Orchestrator
 *
 * Executes plans created by Claude using a local LLM.
 * Updates all Wogi Flow state files after each step.
 *
 * Usage:
 *   flow-orchestrate <plan.json>              # Execute a plan
 *   flow-orchestrate --resume                 # Resume from checkpoint
 *   flow-orchestrate --rollback               # Rollback last execution
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const http = require('http');
const https = require('https');
const readline = require('readline');

// Import complexity assessment module
const {
  assessTaskComplexity,
  TOKEN_BUDGETS,
  getDefaultTokens,
  clampTokens
} = require('./flow-complexity');

// ============================================================
// Configuration
// ============================================================

const PROJECT_ROOT = process.cwd();
const WORKFLOW_DIR = path.join(PROJECT_ROOT, '.workflow');
const STATE_DIR = path.join(WORKFLOW_DIR, 'state');
const TEMPLATES_DIR = path.join(PROJECT_ROOT, 'templates', 'hybrid');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(color, ...args) {
  console.log(colors[color] + args.join(' ') + colors.reset);
}

// ============================================================
// Config Loader
// ============================================================

function loadConfig() {
  const configPath = path.join(WORKFLOW_DIR, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('config.json not found. Run wogi-flow install first.');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function loadHybridConfig() {
  const config = loadConfig();
  const hybrid = config.hybrid || {};

  if (!hybrid.enabled) {
    throw new Error('Hybrid mode is not enabled. Run /wogi-hybrid first.');
  }

  return {
    provider: hybrid.provider || 'ollama',
    endpoint: hybrid.providerEndpoint || 'http://localhost:11434',
    model: hybrid.model || '',
    temperature: hybrid.settings?.temperature ?? 0.7,
    maxTokens: hybrid.settings?.maxTokens ?? 4096,
    maxRetries: hybrid.settings?.maxRetries ?? 2,
    timeout: hybrid.settings?.timeout ?? 120000,
    autoExecute: hybrid.settings?.autoExecute ?? false,
    // Context window can be overridden in config, otherwise auto-detected from model
    contextWindow: hybrid.settings?.contextWindow || null
  };
}

// ============================================================
// Local LLM Client
// ============================================================

class LocalLLM {
  constructor(config) {
    this.config = config;
    this.contextWindow = config.contextWindow || null; // Will be auto-detected
    this.modelInfoFetched = false;
  }

  /**
   * Fetches model info including context window from the provider.
   * Called once on first generate() call.
   */
  async fetchModelInfo() {
    if (this.modelInfoFetched) return;
    this.modelInfoFetched = true;

    try {
      if (this.config.provider === 'ollama') {
        const info = await this.ollamaShowModel();
        if (info.contextLength) {
          this.contextWindow = info.contextLength;
          log('dim', `   📊 Model context window: ${this.contextWindow.toLocaleString()} tokens`);
        }
      } else {
        // LM Studio / OpenAI-compatible
        const info = await this.lmStudioGetModelInfo();
        if (info.contextLength) {
          this.contextWindow = info.contextLength;
          log('dim', `   📊 Model context window: ${this.contextWindow.toLocaleString()} tokens`);
        }
      }
    } catch (e) {
      log('dim', `   ⚠️ Could not fetch model info: ${e.message}`);
      // Fall back to default
      if (!this.contextWindow) {
        this.contextWindow = 4096;
        log('dim', `   📊 Using default context window: ${this.contextWindow} tokens`);
      }
    }
  }

  /**
   * Ollama: GET /api/show to get model parameters
   */
  async ollamaShowModel() {
    return new Promise((resolve, reject) => {
      const url = new URL('/api/show', this.config.endpoint);
      const postData = JSON.stringify({ name: this.config.model });

      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            // Ollama returns model_info with context_length or parameters.num_ctx
            const contextLength =
              parsed.model_info?.['context_length'] ||
              parsed.model_info?.context_length ||
              parsed.parameters?.num_ctx ||
              parsed.details?.parameter_size && 4096; // fallback
            resolve({ contextLength: contextLength || 4096 });
          } catch (e) {
            reject(new Error('Invalid response from Ollama /api/show'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout fetching model info'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * LM Studio: GET /v1/models to get model info
   */
  async lmStudioGetModelInfo() {
    return new Promise((resolve, reject) => {
      const url = new URL('/v1/models', this.config.endpoint);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            // Find our model in the list
            const model = parsed.data?.find(m =>
              m.id === this.config.model ||
              m.id?.includes(this.config.model)
            );
            // LM Studio may include context_length in model object
            const contextLength = model?.context_length || model?.max_tokens || 4096;
            resolve({ contextLength });
          } catch (e) {
            reject(new Error('Invalid response from /v1/models'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout fetching model info'));
      });

      req.end();
    });
  }

  async generate(prompt) {
    // Fetch model info on first call
    await this.fetchModelInfo();

    if (this.config.provider === 'ollama') {
      return this.ollamaGenerate(prompt);
    } else {
      return this.openaiCompatibleGenerate(prompt);
    }
  }

  async ollamaGenerate(prompt) {
    return new Promise((resolve, reject) => {
      const url = new URL('/api/generate', this.config.endpoint);
      const postData = JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens
        }
      });

      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.config.timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.response || '');
          } catch (e) {
            reject(new Error('Invalid response from Ollama'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  async openaiCompatibleGenerate(prompt) {
    return new Promise((resolve, reject) => {
      const url = new URL('/v1/chat/completions', this.config.endpoint);
      const postData = JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });

      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.config.timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content || '');
          } catch (e) {
            reject(new Error('Invalid response from LLM'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }
}

// ============================================================
// Code Extraction
// ============================================================

/**
 * Extracts clean code from LLM response.
 * Handles:
 * - Thinking/reasoning preamble
 * - </think> tags (from models that use thinking tokens)
 * - Markdown code blocks
 * - Trailing explanations
 */
function extractCodeFromResponse(response, modelName = '') {
  if (!response || typeof response !== 'string') {
    return response;
  }

  const rawResponse = response;
  let code = response;

  // 1. Remove everything before </think> tag if present
  const thinkEndMatch = code.match(/<\/think>\s*/i);
  if (thinkEndMatch) {
    code = code.slice(thinkEndMatch.index + thinkEndMatch[0].length);
  }

  // 2. Extract from markdown code blocks if present
  const codeBlockMatch = code.match(/```(?:typescript|tsx|ts|javascript|jsx|js)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    code = codeBlockMatch[1];
  } else {
    // Also try to remove any remaining markdown code block markers
    code = code.replace(/^```(?:typescript|tsx|javascript|jsx|ts|js)?\n/gm, '');
    code = code.replace(/\n```$/gm, '');
    code = code.replace(/^```$/gm, '');
  }

  // 3. Find first valid TypeScript/JavaScript line
  const validStartPatterns = [
    /^import\s/m,
    /^export\s/m,
    /^const\s/m,
    /^let\s/m,
    /^var\s/m,
    /^function\s/m,
    /^async\s+function\s/m,
    /^class\s/m,
    /^interface\s/m,
    /^type\s/m,
    /^enum\s/m,
    /^declare\s/m,
    /^\/\*\*/m,  // JSDoc comment
    /^\/\*[^*]/m, // Block comment
    /^\/\//m,    // Single line comment at start
    /^'use /m,   // 'use strict' or 'use client'
    /^"use /m,
  ];

  let earliestMatch = -1;
  for (const pattern of validStartPatterns) {
    const match = code.search(pattern);
    if (match !== -1 && (earliestMatch === -1 || match < earliestMatch)) {
      earliestMatch = match;
    }
  }

  if (earliestMatch > 0) {
    code = code.slice(earliestMatch);
  }

  // 4. Remove trailing explanations (text after the last closing brace/semicolon followed by blank lines and prose)
  // Look for patterns like "}\n\nBut maybe..." or ";\n\nThat should..."
  const trailingMatch = code.match(/(\}|\;)\s*\n\s*\n+[A-Z][a-z]/);
  if (trailingMatch) {
    code = code.slice(0, trailingMatch.index + 1);
  }

  code = code.trim();

  // Debug logging
  if (process.env.DEBUG_HYBRID) {
    console.log('\n--- RAW LLM RESPONSE (first 500 chars) ---');
    console.log(rawResponse.slice(0, 500));
    console.log('\n--- EXTRACTED CODE (first 500 chars) ---');
    console.log(code.slice(0, 500));
    console.log('---\n');
  }

  return code;
}

/**
 * Validates if the extracted code looks like valid TypeScript/JavaScript.
 * Returns { valid: boolean, reason?: string }
 */
function isValidCode(code) {
  if (!code) {
    return { valid: false, reason: 'Empty output' };
  }

  if (code.length < 10) {
    return { valid: false, reason: 'Output too short' };
  }

  const trimmed = code.trim();

  // Check for common LLM prose patterns that indicate thinking/explanation
  const prosePatterns = [
    /^(We need|Let's|The |I |You |This |Maybe|Probably|Actually|But |So |Thus |Given |Here|Now |First|To |In order)/i,
    /^(Looking at|Based on|According to|As you can|Note that|Remember|Consider|Thinking|Output:)/i,
    /^(```|~~~)/,  // Markdown code fence at start means extraction failed
    /<think>|<\/think>/i,  // Thinking tags leaked through
  ];

  for (const pattern of prosePatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: `Starts with prose/thinking: "${trimmed.slice(0, 50)}..."` };
    }
  }

  // Must start with valid TS/JS syntax
  const validStartPatterns = /^(import|export|const|let|var|function|async|class|interface|type|enum|declare|module|namespace|\/\*\*|\/\*|\/\/|'use |"use |@)/;

  if (!validStartPatterns.test(trimmed)) {
    return { valid: false, reason: `Invalid start: "${trimmed.slice(0, 50)}..."` };
  }

  // Additional sanity checks
  // Should have some code-like structure (braces, semicolons, etc.)
  const hasCodeStructure = /[{};=()]/.test(code);
  if (!hasCodeStructure && code.length > 100) {
    return { valid: false, reason: 'No code structure detected (missing braces/semicolons)' };
  }

  return { valid: true };
}

// ============================================================
// Auto-Correction for Common LLM Mistakes
// ============================================================

/**
 * Gets project context from config for auto-correction and templates.
 * Returns the projectContext section from config.json hybrid settings.
 */
function getProjectContext() {
  try {
    const config = loadConfig();
    return config.hybrid?.projectContext || {};
  } catch (e) {
    return {};
  }
}

/**
 * Auto-corrects common LLM mistakes in generated code.
 * Runs before file write to fix predictable errors.
 *
 * Uses config.json → hybrid.projectContext for project-specific corrections.
 * Falls back to sensible defaults if no config exists.
 */
function autoCorrectCode(code, filePath, projectConfig = null) {
  if (!code || typeof code !== 'string') {
    return { corrected: code, corrections: [] };
  }

  // Load project context from config if not provided
  const ctx = projectConfig?.projectContext || getProjectContext();

  let corrected = code;
  const corrections = [];

  // 1. Remove forbidden imports (from config, defaults to ['React'])
  const doNotImport = ctx.doNotImport || ['React'];
  for (const forbidden of doNotImport) {
    // Case A: Default import - "import X from '...'"
    const defaultImportRegex = new RegExp(`^import ${forbidden} from ['"][^'"]+['"];?\\s*\\n?`, 'gm');
    if (defaultImportRegex.test(corrected)) {
      corrected = corrected.replace(defaultImportRegex, '');
      corrections.push(`Removed forbidden import: ${forbidden}`);
    }

    // Case B: Combined with named imports - "import X, { y, z } from '...'"
    const combinedImportRegex = new RegExp(`^import ${forbidden},\\s*(\\{[^}]+\\})\\s+from\\s+(['"][^'"]+['"])`, 'gm');
    if (combinedImportRegex.test(corrected)) {
      corrected = corrected.replace(combinedImportRegex, 'import $1 from $2');
      corrections.push(`Removed ${forbidden} from combined import`);
    }

    // Case C: Namespace import - "import * as X from '...'"
    const namespaceImportRegex = new RegExp(`^import \\* as ${forbidden} from ['"][^'"]+['"];?\\s*\\n?`, 'gm');
    if (namespaceImportRegex.test(corrected)) {
      corrected = corrected.replace(namespaceImportRegex, '');
      corrections.push(`Removed namespace import: ${forbidden}`);
    }
  }

  // 2. Fix component paths based on config mappings
  const componentPaths = ctx.componentPaths || {};

  // Build reverse mapping from shadcn-style to project paths
  // @/components/ui/button → project's Button path
  const shadcnPattern = /@\/components\/ui\/(\w+)/g;
  corrected = corrected.replace(shadcnPattern, (match, component) => {
    const capitalName = component.charAt(0).toUpperCase() + component.slice(1);
    const configPath = componentPaths[capitalName];
    if (configPath) {
      corrections.push(`Fixed import: ${match} → ${configPath}`);
      return configPath;
    }
    return match; // Leave as-is if no mapping
  });

  // 3. Fix type paths for features (from config)
  const typePaths = ctx.typePaths || { features: '../api/types' };
  if (filePath && filePath.includes('/features/') && typePaths.features) {
    const wrongPaths = ["'../types'", '"../types"', "'./types'", '"./types"'];
    for (const wrong of wrongPaths) {
      if (corrected.includes(wrong)) {
        corrected = corrected.replace(new RegExp(wrong.replace(/['"]/g, '[\'"]'), 'g'), `'${typePaths.features}'`);
        corrections.push('Fixed type import path');
      }
    }
  }

  // 4. Remove external utils if configured (noExternalUtils: true)
  if (ctx.noExternalUtils && corrected.includes('@/lib/utils')) {
    const hadFormatCurrency = corrected.includes('formatCurrency');
    const hadCn = corrected.includes(' cn(') || corrected.includes(' cn`');

    // Remove the import
    corrected = corrected.replace(/^import.*from ['"]@\/lib\/utils['"];?\s*\n?/gm, '');
    corrections.push('Removed @/lib/utils import');

    // Inline formatCurrency if it was used
    if (hadFormatCurrency) {
      const formatCurrencyFn = `\nconst formatCurrency = (amount: number) =>\n  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);\n`;
      // Insert after imports
      const lastImportMatch = corrected.match(/^import[^;]+;?\s*\n/gm);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertPos = corrected.lastIndexOf(lastImport) + lastImport.length;
        corrected = corrected.slice(0, insertPos) + formatCurrencyFn + corrected.slice(insertPos);
      }
      corrections.push('Inlined formatCurrency');
    }

    // Remove cn() usage - just use template literals or className directly
    if (hadCn) {
      corrected = corrected.replace(/cn\((['"`][^'"`]+['"`])\)/g, '$1');
      corrections.push('Removed cn() wrapper');
    }
  }

  // 5. Fix double-quoted imports to single quotes (style consistency)
  const singleQuoteCount = (corrected.match(/from '/g) || []).length;
  const doubleQuoteCount = (corrected.match(/from "/g) || []).length;
  if (singleQuoteCount > doubleQuoteCount && doubleQuoteCount > 0) {
    corrected = corrected.replace(/from "([^"]+)"/g, "from '$1'");
    corrections.push('Normalized import quotes to single quotes');
  }

  // 6. Remove empty import statements (artifact of removing imports)
  corrected = corrected.replace(/^import\s*\{\s*\}\s*from\s*['"][^'"]+['"];?\s*\n?/gm, '');

  // 7. Fix multiple consecutive blank lines (cleanup)
  corrected = corrected.replace(/\n{3,}/g, '\n\n');

  // Log corrections if any
  if (corrections.length > 0 && typeof log === 'function') {
    log('dim', `   🔧 Auto-corrected: ${corrections.join(', ')}`);
  }

  return { corrected: corrected.trim(), corrections };
}

// ============================================================
// Project Auto-Detection (for wogi-init/wogi-onboard)
// ============================================================

/**
 * Detects the UI framework used in the project by checking dependencies.
 * @param {string} projectRoot - Root directory of the project
 * @returns {string} - Framework name: 'styled-components', 'shadcn', 'mui', 'chakra', 'antd', or 'react'
 */
function detectUIFramework(projectRoot = PROJECT_ROOT) {
  try {
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      return 'react';
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    // Check in priority order
    if (deps['styled-components']) return 'styled-components';
    if (deps['@shadcn/ui'] || deps['@radix-ui/react-slot']) return 'shadcn';
    if (deps['@mui/material']) return 'mui';
    if (deps['@chakra-ui/react']) return 'chakra';
    if (deps['antd']) return 'antd';
    if (deps['tailwindcss']) return 'tailwind';

    return 'react'; // vanilla
  } catch (e) {
    return 'react';
  }
}

/**
 * Scans the components directory and builds a mapping of component names to import paths.
 * @param {string} projectRoot - Root directory of the project
 * @param {string[]} componentDirs - Directories to scan (relative to projectRoot)
 * @returns {Object} - Mapping of ComponentName → import path
 */
function scanComponentPaths(projectRoot = PROJECT_ROOT, componentDirs = ['src/components']) {
  const componentPaths = {};

  for (const dir of componentDirs) {
    const fullDir = path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) continue;

    try {
      const scanDir = (dirPath, aliasPath) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
          if (entry.name.includes('.test.') || entry.name.includes('.spec.') || entry.name.includes('.stories.')) continue;

          const entryPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            // Check for index file or component file with same name
            const indexFile = ['index.tsx', 'index.ts', 'index.jsx', 'index.js'].find(f =>
              fs.existsSync(path.join(entryPath, f))
            );

            const componentFile = ['.tsx', '.ts', '.jsx', '.js'].find(ext =>
              fs.existsSync(path.join(entryPath, entry.name + ext))
            );

            if (indexFile || componentFile) {
              // This is a component directory
              const componentName = entry.name;
              const importPath = `${aliasPath}/${entry.name}`;
              componentPaths[componentName] = importPath;
            }

            // Recurse into subdirectories
            scanDir(entryPath, `${aliasPath}/${entry.name}`);
          } else if (entry.isFile()) {
            // Direct component file
            const ext = path.extname(entry.name);
            if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
              const componentName = path.basename(entry.name, ext);
              // Skip index files and lowercase filenames (likely utilities)
              if (componentName === 'index' || componentName[0] === componentName[0].toLowerCase()) continue;

              const importPath = `${aliasPath}/${componentName}`;
              componentPaths[componentName] = importPath;
            }
          }
        }
      };

      // Determine alias path (@/components or relative)
      const aliasPath = dir.startsWith('src/') ? `@/${dir.slice(4)}` : `@/${dir}`;
      scanDir(fullDir, aliasPath);
    } catch (e) {
      log('dim', `   ⚠️ Error scanning ${dir}: ${e.message}`);
    }
  }

  return componentPaths;
}

/**
 * Generates a full projectContext configuration by auto-detecting project settings.
 * Can be called during wogi-init or wogi-onboard.
 * @param {string} projectRoot - Root directory of the project
 * @returns {Object} - projectContext configuration
 */
function generateProjectContext(projectRoot = PROJECT_ROOT) {
  const uiFramework = detectUIFramework(projectRoot);

  // Scan standard component directories
  const componentDirs = ['src/components', 'components', 'src/shared', 'shared'];
  const componentPaths = scanComponentPaths(projectRoot, componentDirs);

  // Default type paths
  const typePaths = {
    features: '../api/types',
    shared: '@/types'
  };

  // Default forbidden imports (React for React 17+)
  const doNotImport = ['React'];

  // NoExternalUtils depends on framework
  const noExternalUtils = uiFramework !== 'shadcn';

  return {
    uiFramework,
    componentPaths,
    typePaths,
    doNotImport,
    noExternalUtils
  };
}

// Export for CLI usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectUIFramework,
    scanComponentPaths,
    generateProjectContext,
    autoCorrectCode,
    extractCodeFromResponse,
    isValidCode
  };
}

// ============================================================
// Project Context Generator - Claude creates once, Local LLM reuses
// ============================================================

/**
 * Generates and caches a comprehensive project context document.
 * This context is generated once (expensive) and reused for all steps (free).
 *
 * The context includes:
 * - Type definitions from the project
 * - Theme structure and correct access paths
 * - Component patterns from existing code
 * - Available components list
 * - Critical rules and conventions
 */
class ProjectContextGenerator {
  constructor(projectRoot = PROJECT_ROOT) {
    this.projectRoot = projectRoot;
    this.contextPath = path.join(projectRoot, '.workflow/state/hybrid-context.md');
    this.cacheMaxAge = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Check if we have a valid cached context (less than 1 hour old)
   */
  hasValidCache() {
    try {
      if (!fs.existsSync(this.contextPath)) return false;
      const stats = fs.statSync(this.contextPath);
      const ageMs = Date.now() - stats.mtimeMs;
      return ageMs < this.cacheMaxAge;
    } catch {
      return false;
    }
  }

  /**
   * Get cached context or null
   */
  getCachedContext() {
    if (!this.hasValidCache()) return null;
    try {
      return fs.readFileSync(this.contextPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Save generated context to cache
   */
  saveContext(context) {
    try {
      const dir = path.dirname(this.contextPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.contextPath, context);
    } catch (e) {
      log('yellow', `   ⚠️ Could not cache context: ${e.message}`);
    }
  }

  /**
   * Simple glob implementation using fs
   */
  globSync(pattern) {
    const results = [];
    const basePath = this.projectRoot;

    // Handle simple patterns like 'apps/web/src/features/*/api/types.ts'
    const parts = pattern.split('/');
    const searchDir = (currentPath, remainingParts) => {
      if (remainingParts.length === 0) {
        if (fs.existsSync(currentPath)) results.push(currentPath);
        return;
      }

      const [current, ...rest] = remainingParts;

      if (current === '*' || current === '**') {
        // Wildcard - search all directories
        try {
          const entries = fs.readdirSync(currentPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              searchDir(path.join(currentPath, entry.name), rest);
              if (current === '**') {
                // ** also searches deeper
                searchDir(path.join(currentPath, entry.name), remainingParts);
              }
            } else if (rest.length === 0) {
              // Check if file matches
              results.push(path.join(currentPath, entry.name));
            }
          }
        } catch {}
      } else if (current.includes('*')) {
        // Pattern like *.tsx
        try {
          const regex = new RegExp('^' + current.replace(/\*/g, '.*') + '$');
          const entries = fs.readdirSync(currentPath, { withFileTypes: true });
          for (const entry of entries) {
            if (regex.test(entry.name)) {
              if (entry.isDirectory()) {
                searchDir(path.join(currentPath, entry.name), rest);
              } else if (rest.length === 0) {
                results.push(path.join(currentPath, entry.name));
              }
            }
          }
        } catch {}
      } else {
        // Exact match
        const nextPath = path.join(currentPath, current);
        if (fs.existsSync(nextPath)) {
          searchDir(nextPath, rest);
        }
      }
    };

    searchDir(basePath, parts);
    return results.map(p => path.relative(basePath, p));
  }

  /**
   * Read file with line limit
   */
  readFile(filePath, maxLines = 100) {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      if (!fs.existsSync(fullPath)) return null;
      const content = fs.readFileSync(fullPath, 'utf-8');
      return content.split('\n').slice(0, maxLines).join('\n');
    } catch {
      return null;
    }
  }

  /**
   * Gather raw project files for context generation
   */
  gatherProjectFiles() {
    const files = {};

    // 1. Find and read type files
    const typePatterns = [
      'apps/web/src/features/*/api/types.ts',
      'apps/api/src/**/dto/*.ts',
      'src/types/*.ts',
      'src/features/*/api/types.ts',
      'src/*/types.ts',
    ];

    for (const pattern of typePatterns) {
      const matches = this.globSync(pattern);
      for (const match of matches.slice(0, 5)) { // Limit to 5 type files
        const content = this.readFile(match, 150);
        if (content) files[match] = content;
      }
    }

    // 2. Read theme file
    const themePaths = [
      'apps/web/src/styles/theme.ts',
      'src/styles/theme.ts',
      'src/theme.ts',
      'src/theme/index.ts',
      'styles/theme.ts',
    ];
    for (const tp of themePaths) {
      const content = this.readFile(tp, 200);
      if (content) {
        files[tp] = content;
        break;
      }
    }

    // 3. Read sample components (2-3 examples)
    const componentPatterns = [
      'apps/web/src/components/*.tsx',
      'apps/web/src/features/*/components/*.tsx',
      'src/components/*.tsx',
      'src/features/*/components/*.tsx',
    ];

    let componentCount = 0;
    for (const pattern of componentPatterns) {
      if (componentCount >= 3) break;
      const matches = this.globSync(pattern)
        .filter(f => !f.includes('.spec') && !f.includes('.test') && !f.includes('index'));
      for (const match of matches.slice(0, 2)) {
        const content = this.readFile(match, 80);
        if (content) {
          files[match] = content;
          componentCount++;
        }
        if (componentCount >= 3) break;
      }
    }

    // 4. Read component index files
    const indexPatterns = [
      'apps/web/src/components/index.ts',
      'apps/web/src/features/*/components/index.ts',
      'src/components/index.ts',
      'src/features/*/components/index.ts',
    ];
    for (const pattern of indexPatterns) {
      const matches = this.globSync(pattern);
      for (const match of matches.slice(0, 3)) {
        const content = this.readFile(match, 50);
        if (content) files[match] = content;
      }
    }

    return files;
  }

  /**
   * Generate smart context from project files
   * This is the fallback when Claude API is not available
   */
  generateSmartContext(projectFiles) {
    let context = '# Project Context for Code Generation\n\n';
    context += '> This context is auto-generated from your project files.\n';
    context += '> Local LLM: Use this as your primary reference.\n\n';

    // Extract types
    context += '## 1. Type Definitions\n\n';
    let hasTypes = false;
    for (const [filePath, content] of Object.entries(projectFiles)) {
      if (filePath.includes('types')) {
        context += `### From \`${filePath}\`\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
        hasTypes = true;
      }
    }
    if (!hasTypes) {
      context += '_No type files found. Define types inline._\n\n';
    }

    // Extract theme info
    context += '## 2. Theme Path Cheatsheet\n\n';
    let hasTheme = false;
    for (const [filePath, content] of Object.entries(projectFiles)) {
      if (filePath.includes('theme')) {
        context += `### Theme Structure (from \`${filePath}\`)\n`;
        context += '```typescript\n' + content + '\n```\n\n';
        hasTheme = true;

        // Add explicit path guidance
        context += `### CORRECT Theme Paths (MUST use these exact paths)
| What | ❌ WRONG | ✅ CORRECT |
|------|----------|-----------|
| Primary color | \`theme.colors.primary\` | \`theme.colors.primary.main\` |
| Success color | \`theme.colors.success\` | \`theme.colors.status.success\` |
| Warning color | \`theme.colors.warning\` | \`theme.colors.status.warning\` |
| Error color | \`theme.colors.error\` | \`theme.colors.status.error\` |
| Border color | \`theme.colors.border\` | \`theme.colors.border.light\` |
| Text color | \`theme.colors.text\` | \`theme.colors.text.primary\` |
| Spacing | \`theme.spacing.4\` | \`theme.spacing[4]\` |
| Font size | \`theme.fontSize.lg\` | \`theme.fontSize.lg\` or \`theme.fontSize['2xl']\` |

`;
        break;
      }
    }
    if (!hasTheme) {
      context += '_No theme file found._\n\n';
    }

    // Extract component patterns
    context += '## 3. Component Patterns\n\n';
    let sampleShown = false;
    for (const [filePath, content] of Object.entries(projectFiles)) {
      if (filePath.includes('components/') && filePath.endsWith('.tsx') && !sampleShown) {
        context += `### Sample Component Pattern (from \`${filePath}\`)\n`;
        context += 'Follow this exact pattern for new components:\n';
        context += '```typescript\n' + content + '\n```\n\n';
        sampleShown = true;
      }
    }
    if (!sampleShown) {
      context += '_No sample components found._\n\n';
    }

    // Add existing components
    context += '## 4. Available Components (DO NOT recreate these)\n\n';
    let hasComponents = false;
    for (const [filePath, content] of Object.entries(projectFiles)) {
      if (filePath.endsWith('index.ts') && filePath.includes('components')) {
        context += `### From \`${filePath}\`\n\`\`\`typescript\n${content}\n\`\`\`\n\n`;
        hasComponents = true;
      }
    }
    if (!hasComponents) {
      context += '_No component index files found._\n\n';
    }

    // Add critical rules
    context += `## 5. Critical Rules (MUST FOLLOW)

### Import Rules
| Rule | ❌ WRONG | ✅ CORRECT |
|------|----------|-----------|
| React imports | \`import React from 'react'\` | \`import { useState, useCallback } from 'react'\` |
| Type imports (features) | \`from '../types'\` | \`from '../api/types'\` |
| Type imports (features) | \`from './types'\` | \`from '../api/types'\` |
| Inventing imports | \`import { X } from '@/utils/X'\` | Only import what exists |

### Styled Components Rules
| Rule | Example |
|------|---------|
| Transient props | \`$active\`, \`$variant\`, \`$size\` (prefix with $) |
| Theme in template | \`\${({ theme }) => theme.colors.primary.main}\` |
| DisplayName | \`ComponentName.displayName = 'ComponentName'\` |

### Export Rules
| Rule | Example |
|------|---------|
| Named exports | \`export function ComponentName() {}\` |
| Type exports | \`export interface Props {}\` or \`export type X = ...\` |
| Props interface | Name it \`ComponentNameProps\` |

## 6. Import Path Conventions

| Type | Path Pattern |
|------|-------------|
| Shared components | \`@/components/ComponentName\` |
| Feature components | \`../components/ComponentName\` or \`./ComponentName\` |
| Types in features | \`../api/types\` |
| Shared types | \`@/types/...\` |
| Icons | \`lucide-react\` |

---

**Remember:** If you're unsure about an import, DON'T INVENT IT. Use inline code or a TODO comment.

`;

    return context;
  }

  /**
   * Minimal context fallback when no project files found
   */
  getMinimalContext() {
    return `# Project Context for Code Generation

## Critical Rules

### Imports
- ❌ NEVER: \`import React from 'react'\` - causes TS6133 unused variable error
- ✅ CORRECT: \`import { useState, useCallback } from 'react'\`

### Type Imports in Features
- ❌ WRONG: \`from '../types'\` or \`from './types'\`
- ✅ CORRECT: \`from '../api/types'\`

### Styled Components
- ✅ Use transient props: \`$active\`, \`$variant\` (with $ prefix)
- ✅ Theme access: \`theme.colors.primary.main\` (not \`theme.colors.primary\`)
- ✅ Add displayName: \`Component.displayName = 'Component'\`

### Exports
- ✅ Use named exports: \`export function ComponentName\`
- ✅ Define Props interface: \`interface ComponentNameProps {}\`
`;
  }

  /**
   * Generate or retrieve project context
   */
  getOrGenerateContext() {
    // Check cache first
    const cached = this.getCachedContext();
    if (cached) {
      return { context: cached, fromCache: true };
    }

    // Gather project files
    const projectFiles = this.gatherProjectFiles();

    if (Object.keys(projectFiles).length === 0) {
      const minimal = this.getMinimalContext();
      return { context: minimal, fromCache: false };
    }

    // Generate context from files
    const context = this.generateSmartContext(projectFiles);

    // Cache it
    this.saveContext(context);

    return { context, fromCache: false };
  }
}

// ============================================================
// Hybrid Metrics Logging
// ============================================================

/**
 * Logs token estimation metrics for accuracy tracking.
 * Saves to .workflow/state/hybrid-metrics.json
 *
 * @param {Object} plan - The executed plan
 * @param {Object} executionResult - Result of execution
 * @param {Object} complexity - Complexity assessment
 */
function logTokenMetrics(plan, executionResult, complexity) {
  const config = loadConfig();
  const logMetrics = config.hybrid?.settings?.tokenEstimation?.logMetrics;

  if (!logMetrics) return;

  const metricsPath = path.join(STATE_DIR, 'hybrid-metrics.json');

  // Load existing metrics or create new array
  let metrics = [];
  if (fs.existsSync(metricsPath)) {
    try {
      metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    } catch {
      metrics = [];
    }
  }

  // Add new metric entry
  const entry = {
    timestamp: new Date().toISOString(),
    planId: plan.planId || 'unknown',
    task: plan.task || 'unknown',
    complexity: {
      level: complexity?.level || 'unknown',
      estimatedTokens: complexity?.estimatedTokens || 0,
      reasoning: complexity?.reasoning || ''
    },
    execution: {
      success: executionResult.success,
      stepsCompleted: executionResult.steps?.filter(s => s.success).length || 0,
      stepsTotal: executionResult.steps?.length || 0,
      escalated: executionResult.escalateToCloud?.length > 0,
      escalatedSteps: executionResult.escalateToCloud?.map(s => s.id) || []
    }
  };

  metrics.push(entry);

  // Keep only last 100 entries to prevent file bloat
  if (metrics.length > 100) {
    metrics = metrics.slice(-100);
  }

  // Save metrics
  try {
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  } catch (e) {
    log('yellow', `   ⚠️ Could not save metrics: ${e.message}`);
  }
}

/**
 * Displays complexity assessment to the user
 */
function displayComplexityAssessment(complexity) {
  log('white', '\n' + '─'.repeat(60));
  log('cyan', '                 COMPLEXITY ASSESSMENT');
  log('white', '─'.repeat(60));

  const levelColors = {
    small: 'green',
    medium: 'yellow',
    large: 'yellow',
    xl: 'red'
  };

  log(levelColors[complexity.level] || 'white', `\n   Level: ${complexity.level.toUpperCase()}`);
  log('white', `   Estimated Tokens: ${complexity.estimatedTokens.toLocaleString()}`);
  log('dim', `   Range: ${complexity.budget.min.toLocaleString()} - ${complexity.budget.max.toLocaleString()}`);
  log('dim', `\n   Reasoning: ${complexity.reasoning}`);

  // Show key factors
  if (complexity.factors.complexityKeywords?.length > 0) {
    log('dim', `   Keywords: ${complexity.factors.complexityKeywords.slice(0, 5).join(', ')}`);
  }

  log('white', '');
}

/**
 * Gets token estimation settings from config
 */
function getTokenEstimationSettings() {
  try {
    const config = loadConfig();
    return {
      enabled: config.hybrid?.settings?.tokenEstimation?.enabled ?? true,
      minTokens: config.hybrid?.settings?.tokenEstimation?.minTokens ?? 1000,
      maxTokens: config.hybrid?.settings?.tokenEstimation?.maxTokens ?? 8000,
      defaultLevel: config.hybrid?.settings?.tokenEstimation?.defaultLevel ?? 'medium',
      logMetrics: config.hybrid?.settings?.tokenEstimation?.logMetrics ?? true
    };
  } catch {
    return {
      enabled: true,
      minTokens: 1000,
      maxTokens: 8000,
      defaultLevel: 'medium',
      logMetrics: true
    };
  }
}

// ============================================================
// Context Management & Auto-Compaction
// ============================================================

/**
 * Estimates token count from text.
 * Uses ~4 characters per token as a rough estimate.
 * This is conservative - actual tokenization varies by model.
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: ~4 chars per token for English text/code
  // Add extra for whitespace and special characters
  return Math.ceil(text.length / 3.5);
}

/**
 * Calculates context usage percentage
 */
function getContextUsage(promptTokens, contextWindow) {
  if (!contextWindow) return 0;
  return Math.round((promptTokens / contextWindow) * 100);
}

/**
 * Smart prompt compaction strategies
 */
const compactionStrategies = {
  /**
   * Truncate file content to relevant sections
   * Keeps imports, target area, and exports
   */
  truncateFileContent(content, maxLines = 200) {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;

    const imports = [];
    const exports = [];
    const middle = [];
    let inImports = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (inImports && (line.startsWith('import ') || line.startsWith('from ') || line.trim() === '')) {
        imports.push(line);
      } else {
        inImports = false;
        if (line.startsWith('export ') && i > lines.length - 50) {
          exports.push(line);
        } else {
          middle.push(line);
        }
      }
    }

    // Keep imports + first/last portions of middle + exports
    const keepFromMiddle = maxLines - imports.length - exports.length;
    const halfKeep = Math.floor(keepFromMiddle / 2);

    const truncatedMiddle = [
      ...middle.slice(0, halfKeep),
      '',
      `// ... ${middle.length - keepFromMiddle} lines truncated for context ...`,
      '',
      ...middle.slice(-halfKeep)
    ];

    return [...imports, ...truncatedMiddle, ...exports].join('\n');
  },

  /**
   * Remove previous errors from retry prompt, keep only the latest
   */
  trimRetryErrors(prompt) {
    const errorSections = prompt.split('## PREVIOUS ERROR');
    if (errorSections.length <= 2) return prompt;

    // Keep base prompt + only the latest error
    return errorSections[0] + '## PREVIOUS ERROR' + errorSections[errorSections.length - 1];
  },

  /**
   * Remove verbose template sections
   */
  trimTemplateVerbosity(prompt) {
    // Remove example sections if prompt is too long
    let trimmed = prompt.replace(/## Examples[\s\S]*?(?=##|$)/gi, '');
    // Remove detailed explanations
    trimmed = trimmed.replace(/\*\*Note:\*\*[\s\S]*?(?=\n\n|$)/gi, '');
    return trimmed;
  }
};

/**
 * Auto-compacts a prompt to fit within context window.
 * Returns { prompt, wasCompacted, originalTokens, finalTokens }
 */
function autoCompactPrompt(prompt, contextWindow, reserveForOutput = 2048) {
  // Sanity check: never reserve more than 50% of context window
  // This prevents the bug where maxTokens == contextWindow causing availableTokens = 0
  const maxReserve = Math.floor(contextWindow / 2);
  if (reserveForOutput > maxReserve) {
    log('dim', `   📊 Capping output reserve from ${reserveForOutput} to ${maxReserve} tokens`);
    reserveForOutput = maxReserve;
  }

  const availableTokens = contextWindow - reserveForOutput;

  // Another sanity check: ensure we have at least 1024 tokens for the prompt
  if (availableTokens < 1024) {
    log('yellow', `   ⚠️ Warning: Very low available tokens (${availableTokens}). Context: ${contextWindow}, Reserve: ${reserveForOutput}`);
  }

  const originalTokens = estimateTokens(prompt);

  if (originalTokens <= availableTokens) {
    return {
      prompt,
      wasCompacted: false,
      originalTokens,
      finalTokens: originalTokens,
      usage: getContextUsage(originalTokens, contextWindow)
    };
  }

  log('yellow', `   ⚠️ Prompt too large (${originalTokens.toLocaleString()} tokens), compacting...`);

  let compacted = prompt;

  // Strategy 1: Trim retry errors
  compacted = compactionStrategies.trimRetryErrors(compacted);
  let tokens = estimateTokens(compacted);
  if (tokens <= availableTokens) {
    log('dim', `   📦 Trimmed retry errors: ${tokens.toLocaleString()} tokens`);
    return { prompt: compacted, wasCompacted: true, originalTokens, finalTokens: tokens, usage: getContextUsage(tokens, contextWindow) };
  }

  // Strategy 2: Trim template verbosity
  compacted = compactionStrategies.trimTemplateVerbosity(compacted);
  tokens = estimateTokens(compacted);
  if (tokens <= availableTokens) {
    log('dim', `   📦 Trimmed template verbosity: ${tokens.toLocaleString()} tokens`);
    return { prompt: compacted, wasCompacted: true, originalTokens, finalTokens: tokens, usage: getContextUsage(tokens, contextWindow) };
  }

  // Strategy 3: Truncate file content in the prompt
  // Find content between ``` markers and truncate
  const codeBlockRegex = /```[\s\S]*?```/g;
  compacted = compacted.replace(codeBlockRegex, (match) => {
    const content = match.slice(3, -3); // Remove ``` markers
    if (content.split('\n').length > 100) {
      const truncated = compactionStrategies.truncateFileContent(content, 100);
      return '```' + truncated + '```';
    }
    return match;
  });

  // Also check for {{currentContent}} style blocks
  const currentContentMatch = compacted.match(/{{currentContent}}[\s\S]*?(?=##|$)/);
  if (currentContentMatch && currentContentMatch[0].length > 5000) {
    const lines = currentContentMatch[0].split('\n');
    const truncated = compactionStrategies.truncateFileContent(lines.slice(1).join('\n'), 150);
    compacted = compacted.replace(currentContentMatch[0], '{{currentContent}}\n' + truncated + '\n\n');
  }

  tokens = estimateTokens(compacted);
  log('dim', `   📦 Truncated file content: ${tokens.toLocaleString()} tokens`);

  // If still too large, do aggressive truncation
  if (tokens > availableTokens) {
    const ratio = availableTokens / tokens;
    const targetLength = Math.floor(compacted.length * ratio * 0.9); // 10% safety margin
    compacted = compacted.slice(0, targetLength) + '\n\n[Content truncated to fit context window]';
    tokens = estimateTokens(compacted);
    log('yellow', `   ⚠️ Aggressive truncation: ${tokens.toLocaleString()} tokens`);
  }

  return {
    prompt: compacted,
    wasCompacted: true,
    originalTokens,
    finalTokens: tokens,
    usage: getContextUsage(tokens, contextWindow)
  };
}

// ============================================================
// Template Engine
// ============================================================

class TemplateEngine {
  constructor(templatesDir) {
    this.templatesDir = templatesDir;
    this.cache = new Map();
  }

  loadTemplate(name) {
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    const templatePath = path.join(this.templatesDir, `${name}.md`);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${name}`);
    }

    let template = fs.readFileSync(templatePath, 'utf-8');

    // Include base template
    const basePath = path.join(this.templatesDir, '_base.md');
    if (fs.existsSync(basePath)) {
      const base = fs.readFileSync(basePath, 'utf-8');
      template = template.replace('{{include _base.md}}', base);
    }

    // Include patterns
    const patternsPath = path.join(this.templatesDir, '_patterns.md');
    if (fs.existsSync(patternsPath)) {
      const patterns = fs.readFileSync(patternsPath, 'utf-8');
      template = template.replace('{{include _patterns.md}}', patterns);
    }

    this.cache.set(name, template);
    return template;
  }

  render(templateName, params) {
    let template = this.loadTemplate(templateName);

    // Simple variable substitution
    const substitute = (str, obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value === null || value === undefined) {
          str = str.replace(new RegExp(`{{${fullKey}}}`, 'g'), '');
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          str = substitute(str, value, fullKey);
        } else if (Array.isArray(value)) {
          const arrayStr = value.map(v => {
            if (typeof v === 'object') {
              return JSON.stringify(v, null, 2);
            }
            return `- ${v}`;
          }).join('\n');
          str = str.replace(new RegExp(`{{${fullKey}}}`, 'g'), arrayStr);
        } else {
          str = str.replace(new RegExp(`{{${fullKey}}}`, 'g'), String(value));
        }
      }
      return str;
    };

    return substitute(template, params);
  }
}

// ============================================================
// Validator
// ============================================================

class Validator {
  static fileExists(filePath) {
    if (fs.existsSync(filePath)) {
      return { success: true, message: 'File exists' };
    }
    return { success: false, message: `File not found: ${filePath}` };
  }

  /**
   * Finds the nearest directory containing a tsconfig.json.
   * Walks up from the file's directory to find the right TypeScript project root.
   * Essential for monorepos where tsconfig is in apps/web/, apps/api/, etc.
   */
  static findTsConfigDir(filePath) {
    if (!filePath) return PROJECT_ROOT;

    let dir = path.dirname(filePath);
    while (dir && dir !== path.dirname(dir)) { // Stop at filesystem root
      const tsconfig = path.join(dir, 'tsconfig.json');
      if (fs.existsSync(tsconfig)) {
        return dir;
      }
      // Also check for package.json as fallback (workspace root)
      const packageJson = path.join(dir, 'package.json');
      if (fs.existsSync(packageJson)) {
        // If this package has a tsconfig, use it
        if (fs.existsSync(path.join(dir, 'tsconfig.json'))) {
          return dir;
        }
      }
      dir = path.dirname(dir);
    }
    return PROJECT_ROOT;
  }

  static typescriptCheck(filePath) {
    try {
      // Find the nearest tsconfig directory (for monorepo support)
      const cwd = this.findTsConfigDir(filePath);
      const tsconfigPath = path.join(cwd, 'tsconfig.json');

      // Check if tsconfig exists in this directory
      if (!fs.existsSync(tsconfigPath)) {
        log('dim', `   ⚠️ No tsconfig.json found, skipping TypeScript check`);
        return { success: true, message: 'TypeScript check skipped (no tsconfig.json)' };
      }

      if (cwd !== PROJECT_ROOT) {
        log('dim', `   📁 Running tsc from: ${path.relative(PROJECT_ROOT, cwd) || '.'}`);
      }

      execSync('npx tsc --noEmit', {
        encoding: 'utf-8',
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true, message: 'TypeScript check passed' };
    } catch (e) {
      const stderr = e.stderr || e.stdout || e.message;

      // Filter out help text (indicates no tsconfig found)
      if (stderr.includes('COMMON COMMANDS') || stderr.includes('tsc: The TypeScript Compiler')) {
        return { success: true, message: 'TypeScript check skipped (tsc could not find project)' };
      }

      // CRITICAL: Filter errors to only include the file we're validating
      // This prevents pre-existing errors in other files from failing validation
      if (filePath) {
        const cwd = this.findTsConfigDir(filePath);
        const relativeFile = path.relative(cwd, filePath);
        const fileName = path.basename(filePath);
        const lines = stderr.split('\n');

        // Find errors that mention our file (by relative path or just filename)
        const relevantErrors = lines.filter(line => {
          // Match lines that contain our file path
          return line.includes(relativeFile) ||
                 line.includes(fileName) ||
                 // Also include "error TS" lines that follow a file match (context)
                 (line.trim().startsWith('error TS') && lines[lines.indexOf(line) - 1]?.includes(fileName));
        });

        if (relevantErrors.length === 0) {
          // Errors exist but not in our file - pass validation
          const errorCount = (stderr.match(/error TS/g) || []).length;
          log('dim', `   ⚠️ ${errorCount} pre-existing error(s) in other files, ${fileName} is clean`);
          return { success: true, message: 'TypeScript check passed (file-specific)' };
        }

        // Errors in our file - fail with relevant errors only
        return {
          success: false,
          message: relevantErrors.slice(0, 10).join('\n')
        };
      }

      return {
        success: false,
        message: stderr.split('\n').slice(0, 10).join('\n')
      };
    }
  }

  static eslintCheck(filePath) {
    try {
      // Also find the right directory for eslint config
      const cwd = this.findTsConfigDir(filePath);
      execSync(`npx eslint "${filePath}" --fix`, {
        encoding: 'utf-8',
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true, message: 'ESLint check passed' };
    } catch (e) {
      const stderr = e.stderr || e.stdout || e.message;
      return {
        success: false,
        message: stderr.split('\n').slice(0, 10).join('\n')
      };
    }
  }

  static runChecks(checks, filePath) {
    const results = [];

    for (const check of checks) {
      let result;
      switch (check) {
        case 'file-exists':
          result = this.fileExists(filePath);
          break;
        case 'typescript-check':
          result = this.typescriptCheck(filePath);  // Now passes filePath
          break;
        case 'eslint-check':
          result = this.eslintCheck(filePath);
          break;
        default:
          result = { success: true, message: `Unknown check: ${check}` };
      }
      results.push({ check, ...result });

      if (!result.success) break;
    }

    return results;
  }
}

// ============================================================
// Rollback Manager
// ============================================================

class RollbackManager {
  constructor() {
    this.createdFiles = [];
    this.modifiedFiles = [];
    this.checkpointPath = path.join(STATE_DIR, 'rollback-checkpoint.json');
  }

  trackCreation(filePath) {
    this.createdFiles.push(filePath);
    this.saveCheckpoint();
  }

  trackModification(filePath) {
    if (fs.existsSync(filePath)) {
      const original = fs.readFileSync(filePath, 'utf-8');
      this.modifiedFiles.push({ path: filePath, original });
      this.saveCheckpoint();
    }
  }

  saveCheckpoint() {
    const checkpoint = {
      createdFiles: this.createdFiles,
      modifiedFiles: this.modifiedFiles,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  loadCheckpoint() {
    if (fs.existsSync(this.checkpointPath)) {
      const checkpoint = JSON.parse(fs.readFileSync(this.checkpointPath, 'utf-8'));
      this.createdFiles = checkpoint.createdFiles || [];
      this.modifiedFiles = checkpoint.modifiedFiles || [];
      return true;
    }
    return false;
  }

  rollback() {
    log('yellow', '\n🔙 Rolling back changes...\n');

    for (const filePath of this.createdFiles) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        log('dim', `  🗑️  Deleted: ${filePath}`);

        let dir = path.dirname(filePath);
        while (dir !== PROJECT_ROOT && fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          if (files.length === 0) {
            fs.rmdirSync(dir);
            log('dim', `  📁 Removed empty: ${dir}`);
            dir = path.dirname(dir);
          } else {
            break;
          }
        }
      }
    }

    for (const { path: filePath, original } of this.modifiedFiles) {
      fs.writeFileSync(filePath, original);
      log('dim', `  ↩️  Restored: ${filePath}`);
    }

    if (fs.existsSync(this.checkpointPath)) {
      fs.unlinkSync(this.checkpointPath);
    }

    this.createdFiles = [];
    this.modifiedFiles = [];

    log('green', '\n✅ Rollback complete\n');
  }

  clearCheckpoint() {
    if (fs.existsSync(this.checkpointPath)) {
      fs.unlinkSync(this.checkpointPath);
    }
    this.createdFiles = [];
    this.modifiedFiles = [];
  }
}

// ============================================================
// State Manager
// ============================================================

class StateManager {
  updateRequestLog(step, status, mode = 'hybrid', executor = '') {
    const logPath = path.join(STATE_DIR, 'request-log.md');
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const entry = `
## ${timestamp} - ${step.title}

**Status:** ${status}
**Type:** ${step.type}
**Mode:** ${mode}${executor ? ` (${executor})` : ''}
${step.params?.path ? `**File:** \`${step.params.path}\`` : ''}

${step.description || ''}

---
`;

    if (fs.existsSync(logPath)) {
      fs.appendFileSync(logPath, entry);
    }
  }

  updateAppMap(update) {
    if (!update) return;

    const mapPath = path.join(STATE_DIR, 'app-map.md');
    if (!fs.existsSync(mapPath)) return;

    let content = fs.readFileSync(mapPath, 'utf-8');
    const { section, entry } = update;

    const sectionRegex = new RegExp(`(## ${section}[\\s\\S]*?)(\n## |$)`);
    const match = content.match(sectionRegex);

    if (match) {
      const [, sectionContent, nextSection] = match;
      const newSection = sectionContent.trimEnd() + `\n- ${entry}\n\n`;
      content = content.replace(sectionRegex, newSection + (nextSection === '\n## ' ? '\n## ' : ''));
      fs.writeFileSync(mapPath, content);
    }
  }

  updateHybridSession(data) {
    const sessionPath = path.join(STATE_DIR, 'hybrid-session.json');

    let session = {
      sessionId: `sess-${Date.now()}`,
      startedAt: new Date().toISOString(),
      autoExecute: false,
      currentPlan: null,
      executedSteps: [],
      failedSteps: [],
      pendingSteps: [],
      totalTokensSaved: 0
    };

    if (fs.existsSync(sessionPath)) {
      session = { ...session, ...JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) };
    }

    Object.assign(session, data);
    session.updatedAt = new Date().toISOString();

    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    return session;
  }

  getHybridSession() {
    const sessionPath = path.join(STATE_DIR, 'hybrid-session.json');
    if (fs.existsSync(sessionPath)) {
      return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    }
    return null;
  }

  saveResults(results) {
    const resultsPath = path.join(STATE_DIR, 'hybrid-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  }

  /**
   * Loads project context from config.json and app-map.md.
   * Returns context that can be used in templates.
   *
   * Reads from:
   * - config.json → hybrid.projectContext (primary source)
   * - app-map.md (supplemental component info)
   */
  loadProjectContext() {
    const context = {
      importPatterns: '',
      availableComponents: '',
      typeLocations: '',
      uiFramework: 'react',
      projectContext: null
    };

    // Try to load from config (primary source)
    const configPath = path.join(WORKFLOW_DIR, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const projectCtx = config.hybrid?.projectContext || {};

        // Store raw project context for auto-correction
        context.projectContext = projectCtx;

        // UI Framework
        if (projectCtx.uiFramework) {
          context.uiFramework = projectCtx.uiFramework;
        }

        // Format component paths for template
        if (projectCtx.componentPaths && Object.keys(projectCtx.componentPaths).length > 0) {
          context.availableComponents = Object.entries(projectCtx.componentPaths)
            .map(([name, path]) => `- ${name}: \`import { ${name} } from '${path}'\``)
            .join('\n');
        }

        // Format type locations
        if (projectCtx.typePaths) {
          context.typeLocations = Object.entries(projectCtx.typePaths)
            .map(([scope, path]) => `- In ${scope}: \`import type { X } from '${path}'\``)
            .join('\n');
        }

        // Format forbidden imports
        if (projectCtx.doNotImport?.length > 0) {
          context.doNotImport = projectCtx.doNotImport.join(', ');
        }

        // Legacy support: importPatterns/typeLocations as strings
        if (config.hybrid?.importPatterns) {
          context.importPatterns = config.hybrid.importPatterns;
        }
      } catch (e) {
        log('dim', `   ⚠️ Could not parse config.json: ${e.message}`);
      }
    }

    // Supplement with app-map.md if available
    const appMapPath = path.join(STATE_DIR, 'app-map.md');
    if (fs.existsSync(appMapPath) && !context.availableComponents) {
      try {
        const appMap = fs.readFileSync(appMapPath, 'utf-8');

        // Extract component sections
        const componentMatch = appMap.match(/## Components[\s\S]*?(?=##|$)/i);
        if (componentMatch) {
          context.availableComponents = componentMatch[0].trim();
        }

        // Extract screens/features
        const screensMatch = appMap.match(/## Screens[\s\S]*?(?=##|$)/i);
        if (screensMatch) {
          context.availableComponents += '\n\n' + screensMatch[0].trim();
        }
      } catch (e) {
        log('dim', `   ⚠️ Could not parse app-map.md: ${e.message}`);
      }
    }

    return context;
  }
}

// ============================================================
// Orchestrator
// ============================================================

class Orchestrator {
  constructor() {
    this.config = loadHybridConfig();
    this.llm = new LocalLLM(this.config);
    this.templates = new TemplateEngine(TEMPLATES_DIR);
    this.rollback = new RollbackManager();
    this.state = new StateManager();
    this.completedSteps = new Set();

    // Project context generator - generates once, reuses for all steps
    this.contextGenerator = new ProjectContextGenerator(PROJECT_ROOT);
    this.projectContext = null;

    // Complexity assessment for the current plan
    this.planComplexity = null;
  }

  /**
   * Ensures project context is loaded (from cache or generated)
   * Called once before executing any steps - local LLM tokens are FREE
   */
  async ensureProjectContext() {
    const { context, fromCache } = this.contextGenerator.getOrGenerateContext();
    this.projectContext = context;

    if (fromCache) {
      log('dim', '📋 Using cached project context');
    } else {
      log('green', '✅ Generated and cached project context');
    }

    const contextTokens = estimateTokens(context);
    log('dim', `   Context size: ~${contextTokens.toLocaleString()} tokens (prepended to each step - FREE)`);
  }

  async executePlan(plan) {
    const results = {
      planId: plan.planId,
      task: plan.task,
      success: true,
      startedAt: new Date().toISOString(),
      steps: [],
      failedSteps: [],
      escalateToCloud: [],
      tokensSaved: plan.estimatedTokensSaved || 0
    };

    // Assess task complexity for token estimation
    const tokenSettings = getTokenEstimationSettings();
    if (tokenSettings.enabled) {
      this.planComplexity = assessTaskComplexity({
        title: plan.task,
        description: plan.description || plan.task,
        // Include step info in complexity assessment
        technicalNotes: plan.steps?.map(s => s.title || s.type).join(', ')
      });

      // Display complexity assessment
      displayComplexityAssessment(this.planComplexity);

      // Warn if task might be too complex for hybrid mode
      if (this.planComplexity.level === 'xl') {
        log('yellow', '   ⚠️ This task is very complex. Consider breaking into smaller tasks.');
        log('yellow', '      Proceeding with maximum token budget...\n');
      }
    } else {
      log('dim', '   Token estimation disabled, using default budget');
      this.planComplexity = {
        level: tokenSettings.defaultLevel,
        estimatedTokens: getDefaultTokens(tokenSettings.defaultLevel),
        reasoning: 'Token estimation disabled'
      };
    }

    // Generate project context ONCE before executing any steps
    // This context is prepended to each step's prompt (local LLM tokens are FREE)
    await this.ensureProjectContext();

    this.state.updateHybridSession({
      currentPlan: plan.planId,
      pendingSteps: plan.steps.map(s => s.id)
    });

    log('cyan', '\n' + '═'.repeat(60));
    log('cyan', '                    EXECUTING PLAN');
    log('cyan', '═'.repeat(60));
    log('white', `\nTask: ${plan.task}`);
    log('white', `Steps: ${plan.steps.length}`);
    log('white', `Model: ${this.config.model}`);
    log('dim', `Token Budget: ${this.planComplexity.estimatedTokens.toLocaleString()} (${this.planComplexity.level})\n`);

    const steps = plan.steps;

    while (this.completedSteps.size < steps.length) {
      const readySteps = steps.filter(step => {
        if (this.completedSteps.has(step.id)) return false;
        if (results.failedSteps.includes(step.id)) return false;

        const deps = step.dependsOn || [];
        return deps.every(d => this.completedSteps.has(d));
      });

      if (readySteps.length === 0) {
        if (this.completedSteps.size + results.failedSteps.length < steps.length) {
          log('red', '\n⚠️ Some steps cannot be executed due to failed dependencies');
          results.success = false;
        }
        break;
      }

      const parallelSteps = readySteps.filter(s => s.canParallelize !== false);
      const sequentialSteps = readySteps.filter(s => s.canParallelize === false);

      if (parallelSteps.length > 1) {
        log('cyan', `\n⚡ Executing ${parallelSteps.length} steps in parallel...\n`);

        const parallelResults = await Promise.all(
          parallelSteps.map(step => this.executeStep(step, plan.context))
        );

        for (let i = 0; i < parallelResults.length; i++) {
          const stepResult = parallelResults[i];
          const step = parallelSteps[i];

          results.steps.push(stepResult);

          if (stepResult.success) {
            this.completedSteps.add(step.id);
          } else {
            results.failedSteps.push(step.id);
            if (stepResult.escalate) {
              results.escalateToCloud.push(step);
            }
            results.success = false;
          }
        }
      }

      for (const step of sequentialSteps) {
        const stepResult = await this.executeStep(step, plan.context);
        results.steps.push(stepResult);

        if (stepResult.success) {
          this.completedSteps.add(step.id);
        } else {
          results.failedSteps.push(step.id);
          if (stepResult.escalate) {
            results.escalateToCloud.push(step);
          }
          results.success = false;
          break;
        }
      }
    }

    results.completedAt = new Date().toISOString();

    this.state.updateHybridSession({
      executedSteps: Array.from(this.completedSteps),
      failedSteps: results.failedSteps,
      pendingSteps: [],
      totalTokensSaved: results.tokensSaved
    });

    this.state.saveResults(results);

    // Log metrics for accuracy tracking
    logTokenMetrics(plan, results, this.planComplexity);

    if (results.success) {
      this.rollback.clearCheckpoint();
    }

    return results;
  }

  async executeStep(step, context) {
    const result = {
      stepId: step.id,
      title: step.title,
      success: false,
      attempts: 0,
      errors: [],
      escalate: false
    };

    log('white', '\n' + '─'.repeat(60));
    log('cyan', `📋 Step ${step.id}: ${step.title}`);
    log('dim', `   Type: ${step.type}`);
    if (step.params?.path) {
      log('dim', `   Path: ${step.params.path}`);
    }

    const templateName = step.template || step.type;

    // Load project-specific context from app-map and config
    const projectContext = this.state.loadProjectContext();

    let params = { ...step.params, ...context, ...projectContext };

    if (step.type === 'modify-file' && step.params?.path) {
      const filePath = step.params.path;
      if (fs.existsSync(filePath)) {
        params.currentContent = fs.readFileSync(filePath, 'utf-8');
        this.rollback.trackModification(filePath);
      }
    }

    let prompt;
    try {
      prompt = this.templates.render(templateName, params);
    } catch (e) {
      result.errors.push(`Template error: ${e.message}`);
      log('red', `   ❌ Template error: ${e.message}`);
      return result;
    }

    // PREPEND PROJECT CONTEXT - Local LLM tokens are FREE
    // This gives the LLM comprehensive knowledge about types, theme, patterns
    if (this.projectContext) {
      prompt = this.projectContext + '\n\n---\n\n# Step Instructions\n\n' + prompt;
    }

    // Show initial context info
    const initialTokens = estimateTokens(prompt);
    log('dim', `   Prompt size: ~${initialTokens.toLocaleString()} tokens (includes project context - FREE)`);

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      result.attempts = attempt + 1;
      log('dim', `   Attempt ${attempt + 1}/${this.config.maxRetries + 1}...`);

      try {
        // Auto-compact prompt if needed
        const contextWindow = this.llm.contextWindow || 4096;
        // Reserve 30% of context for output, but cap at 2048 tokens
        const reserveForOutput = Math.min(2048, Math.floor(contextWindow * 0.3));
        const { prompt: compactedPrompt, wasCompacted, usage } = autoCompactPrompt(
          prompt,
          contextWindow,
          reserveForOutput
        );

        if (wasCompacted) {
          prompt = compactedPrompt;
        }

        // Log context usage
        if (usage > 80) {
          log('yellow', `   ⚠️ Context usage: ${usage}%`);
        } else if (process.env.DEBUG_HYBRID) {
          log('dim', `   Context usage: ${usage}%`);
        }

        const startTime = Date.now();
        const output = await this.llm.generate(prompt);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        log('dim', `   Generated in ${duration}s`);

        let cleanOutput = this.cleanOutput(output);

        const outputPath = step.params?.path;

        // Auto-correct common LLM mistakes (React imports, paths, etc.)
        const { corrected: autoFixed } = autoCorrectCode(cleanOutput, outputPath);
        cleanOutput = autoFixed;

        // CRITICAL: Validate code BEFORE writing to prevent file corruption
        const codeValidation = isValidCode(cleanOutput);
        if (!codeValidation.valid) {
          log('red', `   ❌ Invalid code output: ${codeValidation.reason}`);
          result.errors.push(`Invalid code: ${codeValidation.reason}`);

          // Add error context for retry
          prompt += `\n\n## PREVIOUS ERROR\n\nYour output was not valid code. ${codeValidation.reason}\n\nOutput ONLY valid TypeScript/JavaScript code. No explanations, no markdown, no thinking.`;
          continue; // Skip file write, retry
        }

        if (outputPath) {
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          const isNew = !fs.existsSync(outputPath);

          // For modify-file, do a sanity check: new content shouldn't be drastically smaller
          if (!isNew && step.type === 'modify-file') {
            const existingContent = fs.readFileSync(outputPath, 'utf-8');
            const sizeRatio = cleanOutput.length / existingContent.length;
            if (sizeRatio < 0.3 && existingContent.length > 100) {
              log('red', `   ❌ Output suspiciously small (${Math.round(sizeRatio * 100)}% of original)`);
              result.errors.push('Output file size too small - likely incomplete');
              prompt += `\n\n## PREVIOUS ERROR\n\nYour output was only ${Math.round(sizeRatio * 100)}% the size of the original file. You must output the COMPLETE file, not a partial snippet.`;
              continue; // Skip write, retry
            }
          }

          fs.writeFileSync(outputPath, cleanOutput);

          if (isNew) {
            this.rollback.trackCreation(outputPath);
          }
        }

        const checks = step.validation?.checks || ['file-exists', 'typescript-check'];
        const validationResults = Validator.runChecks(checks, outputPath);

        const allPassed = validationResults.every(r => r.success);

        if (allPassed) {
          result.success = true;

          this.state.updateRequestLog(step, 'completed', 'hybrid', this.config.model);

          if (step.stateUpdates?.appMap) {
            this.state.updateAppMap(step.stateUpdates.appMap);
          }

          log('green', `   ✅ Step completed`);
          return result;
        } else {
          const failedCheck = validationResults.find(r => !r.success);
          result.errors.push(failedCheck.message);
          log('yellow', `   ⚠️ Validation failed: ${failedCheck.check}`);
          log('dim', `      ${failedCheck.message.slice(0, 100)}`);

          prompt += `\n\n## PREVIOUS ERROR\n\n${failedCheck.message}\n\nFix this error and output the corrected code.`;
        }
      } catch (e) {
        result.errors.push(e.message);
        log('red', `   ❌ Error: ${e.message}`);
      }
    }

    result.escalate = true;
    this.state.updateRequestLog(step, 'failed - needs escalation', 'hybrid', this.config.model);
    log('red', `   ❌ Step failed after ${result.attempts} attempts`);
    log('yellow', `   ⬆️ Flagged for escalation to Claude`);

    return result;
  }

  cleanOutput(output) {
    // Use the comprehensive extraction function
    const extracted = extractCodeFromResponse(output, this.config.model);
    return extracted;
  }

  printSummary(results) {
    log('white', '\n' + '═'.repeat(60));
    log('cyan', '                    EXECUTION SUMMARY');
    log('white', '═'.repeat(60));

    const successCount = results.steps.filter(s => s.success).length;
    const totalCount = results.steps.length;

    if (results.success) {
      log('green', `\n✅ Plan executed successfully!`);
    } else {
      log('red', `\n❌ Plan execution failed`);
    }

    log('white', `\nSteps completed: ${successCount}/${totalCount}`);
    log('white', `Tokens saved: ~${results.tokensSaved.toLocaleString()}`);

    if (results.escalateToCloud.length > 0) {
      log('yellow', `\n⚠️ Steps requiring Claude escalation:`);
      for (const step of results.escalateToCloud) {
        log('yellow', `   • Step ${step.id}: ${step.title}`);
      }
    }

    log('dim', `\nResults saved to: .workflow/state/hybrid-results.json`);
    log('white', '');
  }
}

// ============================================================
// Main CLI
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Wogi Flow Hybrid Orchestrator

Usage:
  flow-orchestrate <plan.json>    Execute a plan file
  flow-orchestrate --resume       Resume from checkpoint
  flow-orchestrate --rollback     Rollback last execution
  flow-orchestrate --help         Show this help

Examples:
  ./scripts/flow-orchestrate /tmp/plan.json
  ./scripts/flow-orchestrate --rollback
    `);
    process.exit(0);
  }

  if (args.includes('--rollback')) {
    const rollback = new RollbackManager();
    if (rollback.loadCheckpoint()) {
      rollback.rollback();
    } else {
      log('yellow', 'No rollback checkpoint found.');
    }
    process.exit(0);
  }

  if (args.includes('--resume')) {
    log('yellow', 'Resume not yet implemented');
    process.exit(1);
  }

  const planPath = args[0];
  if (!planPath) {
    console.error('Usage: flow-orchestrate <plan.json>');
    process.exit(1);
  }

  if (!fs.existsSync(planPath)) {
    console.error(`Plan file not found: ${planPath}`);
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));

  try {
    const orchestrator = new Orchestrator();
    const results = await orchestrator.executePlan(plan);
    orchestrator.printSummary(results);

    process.exit(results.success ? 0 : 1);
  } catch (e) {
    log('red', `\n❌ Orchestrator error: ${e.message}`);
    process.exit(1);
  }
}

main();
