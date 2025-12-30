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
    autoExecute: hybrid.settings?.autoExecute ?? false
  };
}

// ============================================================
// Local LLM Client
// ============================================================

class LocalLLM {
  constructor(config) {
    this.config = config;
  }

  async generate(prompt) {
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

  static typescriptCheck() {
    try {
      execSync('npx tsc --noEmit', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true, message: 'TypeScript check passed' };
    } catch (e) {
      const stderr = e.stderr || e.stdout || e.message;
      return {
        success: false,
        message: stderr.split('\n').slice(0, 10).join('\n')
      };
    }
  }

  static eslintCheck(filePath) {
    try {
      execSync(`npx eslint "${filePath}" --fix`, {
        encoding: 'utf-8',
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
          result = this.typescriptCheck();
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
    let params = { ...step.params, ...context };

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

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      result.attempts = attempt + 1;
      log('dim', `   Attempt ${attempt + 1}/${this.config.maxRetries + 1}...`);

      try {
        const startTime = Date.now();
        const output = await this.llm.generate(prompt);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        log('dim', `   Generated in ${duration}s`);

        const cleanOutput = this.cleanOutput(output);

        const outputPath = step.params?.path;
        if (outputPath) {
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          const isNew = !fs.existsSync(outputPath);
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
    let cleaned = output;

    cleaned = cleaned.replace(/^```(?:typescript|tsx|javascript|jsx|ts|js)?\n/gm, '');
    cleaned = cleaned.replace(/\n```$/gm, '');
    cleaned = cleaned.replace(/^```$/gm, '');

    cleaned = cleaned.trim();

    return cleaned;
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
