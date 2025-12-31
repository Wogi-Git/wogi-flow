#!/usr/bin/env node

/**
 * Wogi Flow - Model Provider Abstraction
 *
 * Unified interface for local and cloud LLM providers:
 * - Ollama (local)
 * - LM Studio (local)
 * - Anthropic (cloud)
 * - OpenAI (cloud)
 *
 * Usage as module:
 *   const { createProvider, listProviders } = require('./flow-providers');
 *   const provider = createProvider({ type: 'anthropic', apiKey: '...' });
 *   const response = await provider.complete(prompt, options);
 *
 * Usage as CLI:
 *   flow providers list                 # List available providers
 *   flow providers test <type>          # Test a provider
 *   flow providers configure <type>     # Configure a provider
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const PROJECT_ROOT = process.cwd();
const WORKFLOW_DIR = path.join(PROJECT_ROOT, '.workflow');
const CONFIG_PATH = path.join(WORKFLOW_DIR, 'config.json');

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

/**
 * Provider types
 */
const PROVIDER_TYPES = {
  OLLAMA: 'ollama',
  LM_STUDIO: 'lm-studio',
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai'
};

/**
 * Default provider configurations
 */
const DEFAULT_CONFIGS = {
  ollama: {
    endpoint: 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000
  },
  'lm-studio': {
    endpoint: 'http://localhost:1234/v1',
    model: 'local-model',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 60000
  },
  openai: {
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 60000
  }
};

/**
 * Base provider class
 */
class BaseProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
  }

  async complete(prompt, options = {}) {
    throw new Error('Not implemented');
  }

  async test() {
    try {
      const response = await this.complete('Say "OK" if you can hear me.', {
        maxTokens: 10
      });
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listModels() {
    return [];
  }
}

/**
 * Ollama provider
 */
class OllamaProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'ollama';
  }

  async complete(prompt, options = {}) {
    const endpoint = this.config.endpoint || DEFAULT_CONFIGS.ollama.endpoint;
    const url = new URL('/api/generate', endpoint);

    const body = {
      model: options.model || this.config.model || DEFAULT_CONFIGS.ollama.model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature || this.config.temperature || 0.7,
        num_predict: options.maxTokens || this.config.maxTokens || 4096
      }
    };

    const response = await this._request(url, body);
    return {
      content: response.response,
      model: response.model,
      usage: {
        promptTokens: response.prompt_eval_count,
        completionTokens: response.eval_count,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
      }
    };
  }

  async listModels() {
    const endpoint = this.config.endpoint || DEFAULT_CONFIGS.ollama.endpoint;
    const url = new URL('/api/tags', endpoint);

    try {
      const response = await this._request(url, null, 'GET');
      return (response.models || []).map(m => ({
        id: m.name,
        name: m.name,
        size: m.size
      }));
    } catch {
      return [];
    }
  }

  _request(url, body, method = 'POST') {
    return new Promise((resolve, reject) => {
      const options = {
        method,
        hostname: url.hostname,
        port: url.port || 11434,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.config.timeout || 120000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid response: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}

/**
 * LM Studio provider (OpenAI-compatible)
 */
class LMStudioProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'lm-studio';
  }

  async complete(prompt, options = {}) {
    const endpoint = this.config.endpoint || DEFAULT_CONFIGS['lm-studio'].endpoint;
    const url = new URL('/chat/completions', endpoint);

    const body = {
      model: options.model || this.config.model || 'local-model',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || this.config.temperature || 0.7,
      max_tokens: options.maxTokens || this.config.maxTokens || 4096
    };

    const response = await this._request(url, body);
    return {
      content: response.choices?.[0]?.message?.content || '',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens
      }
    };
  }

  _request(url, body) {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || 1234,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.config.timeout || 120000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid response: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}

/**
 * Anthropic provider
 */
class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'anthropic';
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  }

  async complete(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY or provide apiKey in config.');
    }

    const endpoint = this.config.endpoint || DEFAULT_CONFIGS.anthropic.endpoint;
    const url = new URL('/messages', endpoint);

    const body = {
      model: options.model || this.config.model || DEFAULT_CONFIGS.anthropic.model,
      max_tokens: options.maxTokens || this.config.maxTokens || 4096,
      messages: [{ role: 'user', content: prompt }]
    };

    if (options.system || this.config.system) {
      body.system = options.system || this.config.system;
    }

    const response = await this._request(url, body);

    if (response.error) {
      throw new Error(response.error.message);
    }

    return {
      content: response.content?.[0]?.text || '',
      model: response.model,
      stopReason: response.stop_reason,
      usage: {
        promptTokens: response.usage?.input_tokens,
        completionTokens: response.usage?.output_tokens,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }

  _request(url, body) {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: this.config.timeout || 60000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid response: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.write(JSON.stringify(body));
      req.end();
    });
  }
}

/**
 * OpenAI provider
 */
class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'openai';
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  }

  async complete(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY or provide apiKey in config.');
    }

    const endpoint = this.config.endpoint || DEFAULT_CONFIGS.openai.endpoint;
    const url = new URL('/chat/completions', endpoint);

    const messages = [{ role: 'user', content: prompt }];

    if (options.system || this.config.system) {
      messages.unshift({ role: 'system', content: options.system || this.config.system });
    }

    const body = {
      model: options.model || this.config.model || DEFAULT_CONFIGS.openai.model,
      messages,
      temperature: options.temperature || this.config.temperature || 0.7,
      max_tokens: options.maxTokens || this.config.maxTokens || 4096
    };

    const response = await this._request(url, body);

    if (response.error) {
      throw new Error(response.error.message);
    }

    return {
      content: response.choices?.[0]?.message?.content || '',
      model: response.model,
      stopReason: response.choices?.[0]?.finish_reason,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens
      }
    };
  }

  async listModels() {
    if (!this.apiKey) return [];

    const endpoint = this.config.endpoint || DEFAULT_CONFIGS.openai.endpoint;
    const url = new URL('/models', endpoint);

    try {
      const response = await this._request(url, null, 'GET');
      return (response.data || [])
        .filter(m => m.id.includes('gpt'))
        .map(m => ({
          id: m.id,
          name: m.id,
          owned_by: m.owned_by
        }));
    } catch {
      return [];
    }
  }

  _request(url, body, method = 'POST') {
    return new Promise((resolve, reject) => {
      const options = {
        method,
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: this.config.timeout || 60000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid response: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}

/**
 * Create a provider instance
 */
function createProvider(config) {
  const type = config.type || config.provider;

  switch (type) {
    case PROVIDER_TYPES.OLLAMA:
      return new OllamaProvider(config);
    case PROVIDER_TYPES.LM_STUDIO:
      return new LMStudioProvider(config);
    case PROVIDER_TYPES.ANTHROPIC:
      return new AnthropicProvider(config);
    case PROVIDER_TYPES.OPENAI:
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * List all available providers
 */
function listProviders() {
  return [
    {
      type: PROVIDER_TYPES.OLLAMA,
      name: 'Ollama',
      local: true,
      requiresKey: false,
      defaultEndpoint: DEFAULT_CONFIGS.ollama.endpoint
    },
    {
      type: PROVIDER_TYPES.LM_STUDIO,
      name: 'LM Studio',
      local: true,
      requiresKey: false,
      defaultEndpoint: DEFAULT_CONFIGS['lm-studio'].endpoint
    },
    {
      type: PROVIDER_TYPES.ANTHROPIC,
      name: 'Anthropic',
      local: false,
      requiresKey: true,
      envVar: 'ANTHROPIC_API_KEY',
      defaultEndpoint: DEFAULT_CONFIGS.anthropic.endpoint
    },
    {
      type: PROVIDER_TYPES.OPENAI,
      name: 'OpenAI',
      local: false,
      requiresKey: true,
      envVar: 'OPENAI_API_KEY',
      defaultEndpoint: DEFAULT_CONFIGS.openai.endpoint
    }
  ];
}

/**
 * Detect available providers
 */
async function detectProviders() {
  const available = [];

  // Check Ollama
  try {
    const ollama = new OllamaProvider({});
    const models = await ollama.listModels();
    if (models.length > 0) {
      available.push({
        type: PROVIDER_TYPES.OLLAMA,
        name: 'Ollama',
        models: models.slice(0, 5)
      });
    }
  } catch {
    // Not available
  }

  // Check LM Studio
  try {
    const lmStudio = new LMStudioProvider({});
    const result = await lmStudio.test();
    if (result.success) {
      available.push({
        type: PROVIDER_TYPES.LM_STUDIO,
        name: 'LM Studio',
        models: []
      });
    }
  } catch {
    // Not available
  }

  // Check Anthropic (if key present)
  if (process.env.ANTHROPIC_API_KEY) {
    available.push({
      type: PROVIDER_TYPES.ANTHROPIC,
      name: 'Anthropic',
      models: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' }
      ]
    });
  }

  // Check OpenAI (if key present)
  if (process.env.OPENAI_API_KEY) {
    available.push({
      type: PROVIDER_TYPES.OPENAI,
      name: 'OpenAI',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
      ]
    });
  }

  return available;
}

/**
 * Load provider from config
 */
function loadProviderFromConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const hybridConfig = config.hybrid || {};

    if (!hybridConfig.enabled || !hybridConfig.provider) {
      return null;
    }

    return createProvider({
      type: hybridConfig.provider,
      endpoint: hybridConfig.providerEndpoint,
      model: hybridConfig.model,
      apiKey: hybridConfig.apiKey,
      ...hybridConfig.settings
    });
  } catch {
    return null;
  }
}

// Module exports
module.exports = {
  PROVIDER_TYPES,
  DEFAULT_CONFIGS,
  BaseProvider,
  OllamaProvider,
  LMStudioProvider,
  AnthropicProvider,
  OpenAIProvider,
  createProvider,
  listProviders,
  detectProviders,
  loadProviderFromConfig
};

// CLI Handler
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  async function main() {
    switch (command) {
      case 'list': {
        const providers = listProviders();
        console.log(`\n${c.cyan}${c.bold}Available Providers${c.reset}\n`);

        for (const p of providers) {
          const icon = p.local ? '🏠' : '☁️';
          const keyStatus = p.requiresKey
            ? (process.env[p.envVar] ? `${c.green}✓ API key set${c.reset}` : `${c.yellow}⚠ Requires ${p.envVar}${c.reset}`)
            : `${c.green}✓ No key required${c.reset}`;

          console.log(`${icon} ${c.bold}${p.name}${c.reset} (${p.type})`);
          console.log(`   ${keyStatus}`);
          console.log(`   Endpoint: ${p.defaultEndpoint}`);
          console.log('');
        }
        break;
      }

      case 'detect': {
        console.log(`\n${c.cyan}Detecting available providers...${c.reset}\n`);
        const available = await detectProviders();

        if (available.length === 0) {
          console.log(`${c.yellow}No providers detected.${c.reset}`);
          console.log(`${c.dim}Make sure Ollama/LM Studio is running, or set API keys.${c.reset}`);
        } else {
          for (const p of available) {
            console.log(`${c.green}✅ ${p.name}${c.reset}`);
            if (p.models && p.models.length > 0) {
              console.log(`   Models: ${p.models.map(m => m.id).join(', ')}`);
            }
          }
        }
        break;
      }

      case 'test': {
        const providerType = args[1];
        if (!providerType) {
          console.error(`${c.red}Error: Provider type required${c.reset}`);
          console.log(`${c.dim}Usage: flow providers test <ollama|lm-studio|anthropic|openai>${c.reset}`);
          process.exit(1);
        }

        console.log(`${c.cyan}Testing ${providerType}...${c.reset}`);

        try {
          const provider = createProvider({ type: providerType });
          const result = await provider.test();

          if (result.success) {
            console.log(`${c.green}✅ ${providerType} is working${c.reset}`);
            console.log(`   Response: ${result.response.content.slice(0, 50)}...`);
          } else {
            console.log(`${c.red}❌ ${providerType} test failed${c.reset}`);
            console.log(`   Error: ${result.error}`);
          }
        } catch (err) {
          console.log(`${c.red}❌ ${providerType} test failed${c.reset}`);
          console.log(`   Error: ${err.message}`);
        }
        break;
      }

      default: {
        console.log(`
${c.cyan}Wogi Flow - Model Providers${c.reset}

${c.bold}Usage:${c.reset}
  flow providers list              List all available providers
  flow providers detect            Detect running local providers
  flow providers test <type>       Test a provider connection

${c.bold}Supported Providers:${c.reset}
  ollama        Local Ollama instance
  lm-studio     Local LM Studio instance
  anthropic     Anthropic API (requires ANTHROPIC_API_KEY)
  openai        OpenAI API (requires OPENAI_API_KEY)

${c.bold}Configuration:${c.reset}
  Set in .workflow/config.json under "hybrid":
  {
    "hybrid": {
      "enabled": true,
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "apiKey": "sk-..." // or use environment variable
    }
  }
        `);
      }
    }
  }

  main().catch(err => {
    console.error(`${c.red}Error: ${err.message}${c.reset}`);
    process.exit(1);
  });
}
