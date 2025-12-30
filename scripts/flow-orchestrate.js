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
   * Loads project context from app-map.md and config.
   * Returns context that can be used in templates.
   */
  loadProjectContext() {
    const context = {
      importPatterns: '',
      availableComponents: '',
      typeLocations: ''
    };

    // Try to load from app-map.md
    const appMapPath = path.join(STATE_DIR, 'app-map.md');
    if (fs.existsSync(appMapPath)) {
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

    // Try to load from config
    const configPath = path.join(WORKFLOW_DIR, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        if (config.hybrid?.importPatterns) {
          context.importPatterns = config.hybrid.importPatterns;
        }

        if (config.hybrid?.typeLocations) {
          context.typeLocations = config.hybrid.typeLocations;
        }
      } catch (e) {
        // Ignore config parse errors
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

    this.state.updateHybridSession({
      currentPlan: plan.planId,
      pendingSteps: plan.steps.map(s => s.id)
    });

    log('cyan', '\n' + '═'.repeat(60));
    log('cyan', '                    EXECUTING PLAN');
    log('cyan', '═'.repeat(60));
    log('white', `\nTask: ${plan.task}`);
    log('white', `Steps: ${plan.steps.length}`);
    log('white', `Model: ${this.config.model}\n`);

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

    // Show initial context info
    const initialTokens = estimateTokens(prompt);
    log('dim', `   Prompt size: ~${initialTokens.toLocaleString()} tokens`);

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

        const cleanOutput = this.cleanOutput(output);

        // CRITICAL: Validate code BEFORE writing to prevent file corruption
        const codeValidation = isValidCode(cleanOutput);
        if (!codeValidation.valid) {
          log('red', `   ❌ Invalid code output: ${codeValidation.reason}`);
          result.errors.push(`Invalid code: ${codeValidation.reason}`);

          // Add error context for retry
          prompt += `\n\n## PREVIOUS ERROR\n\nYour output was not valid code. ${codeValidation.reason}\n\nOutput ONLY valid TypeScript/JavaScript code. No explanations, no markdown, no thinking.`;
          continue; // Skip file write, retry
        }

        const outputPath = step.params?.path;
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
