#!/usr/bin/env node

/**
 * Wogi Flow - Hybrid Mode Interactive Setup
 *
 * Guides user through enabling hybrid mode.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const http = require('http');
const { getProjectRoot } = require('./flow-utils');

const PROJECT_ROOT = getProjectRoot();
const WORKFLOW_DIR = path.join(PROJECT_ROOT, '.workflow');
const CONFIG_PATH = path.join(WORKFLOW_DIR, 'config.json');

// Colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const symbols = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  check: '✓',
  cross: '✗'
};

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

class Spinner {
  constructor(text) {
    this.text = text;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.frameIndex = 0;
    this.interval = null;
  }

  start() {
    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      process.stdout.write(`\r${colors.cyan}${frame}${colors.reset} ${this.text}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
  }

  stop(finalText, success = true) {
    clearInterval(this.interval);
    const symbol = success ? colors.green + symbols.check : colors.red + symbols.cross;
    process.stdout.write(`\r${symbol}${colors.reset} ${finalText || this.text}\n`);
  }
}

async function checkEndpoint(url, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ success: true, data: JSON.parse(data) });
        } catch (e) {
          resolve({ success: false, error: 'Invalid response' });
        }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
  });
}

async function detectProviders() {
  console.log(`\n${symbols.info} Detecting local LLM providers...\n`);

  const spinner = new Spinner('Scanning...');
  spinner.start();

  const providers = [];

  // Check Ollama
  const ollamaResult = await checkEndpoint('http://localhost:11434/api/tags');
  if (ollamaResult.success) {
    providers.push({
      id: 'ollama',
      name: 'Ollama',
      endpoint: 'http://localhost:11434',
      available: true,
      models: ollamaResult.data.models?.map(m => ({ id: m.name, name: m.name })) || []
    });
  } else {
    providers.push({ id: 'ollama', name: 'Ollama', available: false, error: ollamaResult.error });
  }

  // Check LM Studio
  const lmstudioResult = await checkEndpoint('http://localhost:1234/v1/models');
  if (lmstudioResult.success) {
    providers.push({
      id: 'lmstudio',
      name: 'LM Studio',
      endpoint: 'http://localhost:1234',
      available: true,
      models: lmstudioResult.data.data?.map(m => ({ id: m.id, name: m.id })) || []
    });
  } else {
    providers.push({ id: 'lmstudio', name: 'LM Studio', available: false, error: lmstudioResult.error });
  }

  spinner.stop('Detection complete', true);

  return providers;
}

async function selectProvider(providers) {
  const available = providers.filter(p => p.available);

  if (available.length === 0) {
    console.log(`\n${colors.red}${symbols.error} No local LLM providers detected!${colors.reset}`);
    console.log(`\nPlease start one of the following:`);
    console.log(`  ${colors.cyan}Ollama:${colors.reset} ollama serve`);
    console.log(`  ${colors.cyan}LM Studio:${colors.reset} Start the app and enable server`);
    console.log(`\nThen run /wogi-hybrid again.`);
    return null;
  }

  console.log(`\n${colors.green}${symbols.success} Found providers:${colors.reset}\n`);

  available.forEach((p, i) => {
    console.log(`  ${colors.cyan}[${i + 1}]${colors.reset} ${p.name} (${p.endpoint})`);
    console.log(`      Models: ${p.models.length}`);
  });

  if (available.length === 1) {
    console.log(`\nUsing ${available[0].name} (only available provider)`);
    return available[0];
  }

  const choice = await prompt(`\nSelect provider [1-${available.length}]: `);
  const index = parseInt(choice) - 1;

  if (index >= 0 && index < available.length) {
    return available[index];
  }

  return available[0];
}

async function selectModel(provider) {
  if (!provider.models || provider.models.length === 0) {
    console.log(`\n${colors.yellow}${symbols.warning} No models found on ${provider.name}${colors.reset}`);
    console.log(`\nPlease load a model first:`);

    if (provider.id === 'ollama') {
      console.log(`  ${colors.cyan}ollama pull nemotron-3-nano${colors.reset}`);
      console.log(`  ${colors.cyan}ollama pull qwen3-coder:30b${colors.reset}`);
    } else {
      console.log(`  Open LM Studio and download a model`);
    }

    return null;
  }

  console.log(`\n${colors.cyan}Available models:${colors.reset}\n`);

  provider.models.forEach((m, i) => {
    console.log(`  ${colors.cyan}[${i + 1}]${colors.reset} ${m.name}`);
  });

  const choice = await prompt(`\nSelect model [1-${provider.models.length}]: `);
  const index = parseInt(choice) - 1;

  if (index >= 0 && index < provider.models.length) {
    return provider.models[index];
  }

  return provider.models[0];
}

async function saveConfig(provider, model) {
  let config = {};

  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  }

  config.hybrid = {
    enabled: true,
    provider: provider.id,
    providerEndpoint: provider.endpoint,
    model: model.id,
    settings: {
      temperature: 0.7,
      maxTokens: 4096,
      maxRetries: 2,
      timeout: 120000,
      autoExecute: false,
      createBranch: false
    },
    templates: {
      directory: 'templates/hybrid'
    }
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  console.log(`\n${colors.green}${symbols.success} Configuration saved!${colors.reset}`);
}

async function testConnection(provider, model) {
  console.log(`\n${symbols.info} Testing connection to ${model.name}...`);

  const spinner = new Spinner('Sending test prompt...');
  spinner.start();

  try {
    await new Promise((resolve, reject) => {
      const isOllama = provider.id === 'ollama';
      const url = new URL(isOllama ? '/api/generate' : '/v1/chat/completions', provider.endpoint);

      const body = isOllama
        ? JSON.stringify({ model: model.id, prompt: 'Say "OK"', stream: false })
        : JSON.stringify({ model: model.id, messages: [{ role: 'user', content: 'Say "OK"' }], max_tokens: 10 });

      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(body);
      req.end();
    });

    spinner.stop('Connection successful!', true);
    return true;
  } catch (e) {
    spinner.stop(`Connection failed: ${e.message}`, false);
    return false;
  }
}

async function main() {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════════════╗
║              Wogi Flow - Hybrid Mode Setup                     ║
╚═══════════════════════════════════════════════════════════════╝${colors.reset}
`);

  // Check if workflow dir exists
  if (!fs.existsSync(WORKFLOW_DIR)) {
    console.log(`${colors.red}${symbols.error} Wogi Flow not installed in this project.${colors.reset}`);
    console.log(`Run /wogi-onboard first.`);
    process.exit(1);
  }

  // Detect providers
  const providers = await detectProviders();

  // Select provider
  const provider = await selectProvider(providers);
  if (!provider) {
    process.exit(1);
  }

  // Select model
  const model = await selectModel(provider);
  if (!model) {
    process.exit(1);
  }

  // Test connection
  const connected = await testConnection(provider, model);
  if (!connected) {
    const cont = await prompt('\nContinue anyway? [y/N]: ');
    if (cont.toLowerCase() !== 'y') {
      process.exit(1);
    }
  }

  // Save config
  await saveConfig(provider, model);

  // Summary
  console.log(`
${colors.green}═══════════════════════════════════════════════════════════════${colors.reset}
${colors.green}              Hybrid Mode Enabled!${colors.reset}
${colors.green}═══════════════════════════════════════════════════════════════${colors.reset}

Provider: ${provider.name}
Model: ${model.name}
Endpoint: ${provider.endpoint}

${colors.cyan}How it works:${colors.reset}
1. Give me a task as usual
2. I'll create an execution plan
3. You review and approve
4. ${model.name} executes locally
5. I handle any failures

${colors.cyan}Commands:${colors.reset}
  /wogi-hybrid-off     Disable hybrid mode
  /wogi-hybrid-status  Check configuration
  /wogi-hybrid-edit    Modify plan before execution

${colors.dim}Estimated token savings: 85-95%${colors.reset}
`);
}

main().catch(e => {
  console.error(`${colors.red}Error: ${e.message}${colors.reset}`);
  process.exit(1);
});
