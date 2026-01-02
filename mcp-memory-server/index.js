#!/usr/bin/env node

/**
 * MCP Memory Server for Wogi Flow
 *
 * Provides memory tools for Claude and other agents:
 * - remember_fact: Store facts in local SQLite with embeddings
 * - recall_facts: Semantic search over stored facts
 * - forget_fact: Remove facts from memory
 * - propose_team_rule: Create team proposals (requires team subscription)
 * - get_pending_proposals: View pending proposals
 * - vote_proposal: Vote on proposals
 * - store_prd: Store PRD chunks with embeddings
 * - get_prd_context: Retrieve relevant PRD context
 *
 * Uses shared flow-memory-db.js module for all database operations.
 * Free tier: All local operations work
 * Paid tier: Team operations sync to api.wogi-flow.com
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');

// Use shared memory database module
const memoryDb = require('../scripts/flow-memory-db');

// ============================================================
// Configuration
// ============================================================

const PROJECT_ROOT = process.env.WOGI_PROJECT_ROOT || process.cwd();
const CONFIG_PATH = path.join(PROJECT_ROOT, '.workflow', 'config.json');

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    // Ignore errors
  }
  return {};
}

function isTeamEnabled() {
  const config = getConfig();
  return config.team?.enabled && config.team?.teamId && config.team?.apiKey;
}

// ============================================================
// Tool Implementations (delegates to shared module)
// ============================================================

async function rememberFact({ fact, category, scope, model, sourceContext }) {
  const result = await memoryDb.storeFact({
    fact,
    category: category || 'general',
    scope: scope || 'local',
    model: model || null,
    sourceContext: sourceContext || null
  });

  // If team scope, create a proposal
  if (scope === 'team') {
    if (!isTeamEnabled()) {
      return {
        id: result.id,
        stored: true,
        warning: 'Team features require a subscription. Fact stored locally only.'
      };
    }

    await memoryDb.createProposal({
      rule: fact,
      category: category || 'pattern',
      rationale: 'Auto-proposed from correction',
      sourceContext
    });

    return { id: result.id, stored: true, proposalCreated: true };
  }

  return result;
}

async function recallFacts({ query, category, limit = 10, includeTeam = true }) {
  return await memoryDb.searchFacts({
    query,
    category,
    limit,
    scope: includeTeam ? undefined : 'local'
  });
}

async function forgetFact({ factId }) {
  return await memoryDb.deleteFact(factId);
}

async function proposeTeamRule({ rule, category, rationale, sourceContext }) {
  if (!isTeamEnabled()) {
    return {
      success: false,
      error: 'Team features require a subscription. Use scope: "local" for local-only storage.'
    };
  }

  const result = await memoryDb.createProposal({
    rule,
    category: category || 'pattern',
    rationale: rationale || '',
    sourceContext: sourceContext || null
  });

  return {
    id: result.id,
    status: 'pending',
    message: 'Proposal created. Will sync to team on next sync.'
  };
}

async function getPendingProposals({}) {
  return await memoryDb.getProposals('pending');
}

async function voteProposal({ proposalId, vote, comment }) {
  if (!isTeamEnabled()) {
    return { success: false, error: 'Team features require a subscription.' };
  }

  const proposals = await memoryDb.getProposals('pending');
  const proposal = proposals.find(p => p.id === proposalId);

  if (!proposal) {
    return { success: false, error: 'Proposal not found' };
  }

  const votes = proposal.votes || [];
  votes.push({
    vote,
    comment: comment || '',
    timestamp: new Date().toISOString()
  });

  await memoryDb.updateProposal(proposalId, { votes });

  return { success: true, voteRecorded: true };
}

async function storePrd({ content, projectId, sections }) {
  const result = await memoryDb.storePRD({
    content,
    prdId: projectId || 'default',
    fileName: null
  });

  return {
    stored: true,
    chunks: result.chunkCount,
    sections: result.sections
  };
}

async function getPrdContext({ taskDescription, maxTokens = 2000 }) {
  const result = await memoryDb.getPRDContext({
    query: taskDescription,
    maxTokens
  });

  if (!result) {
    return { context: 'No PRD context available.', chunksIncluded: 0, topRelevance: 0 };
  }

  return {
    context: result.context,
    topRelevance: result.topRelevance
  };
}

async function getMemoryStats({}) {
  const stats = await memoryDb.getStats();
  return {
    facts: stats.facts,
    proposals: stats.proposals,
    prd: {
      chunks: stats.prds.chunks,
      total: stats.prds.total
    },
    teamEnabled: isTeamEnabled()
  };
}

// ============================================================
// MCP Server Setup
// ============================================================

const TOOLS = [
  {
    name: 'remember_fact',
    description: 'Store a fact in memory. Use scope: "local" for project-only, "team" to propose to team (requires subscription).',
    inputSchema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'The fact to remember' },
        category: {
          type: 'string',
          enum: ['project', 'skill', 'decision', 'pattern', 'anti-pattern', 'model-specific', 'general'],
          description: 'Category of the fact'
        },
        scope: {
          type: 'string',
          enum: ['local', 'team'],
          description: 'local = this project only, team = propose to team (paid feature)'
        },
        model: {
          type: 'string',
          description: 'If model-specific, which model this applies to (e.g., claude-opus-4, gemini-pro)'
        },
        sourceContext: {
          type: 'string',
          description: 'Context about where this fact came from (e.g., task ID, file path)'
        }
      },
      required: ['fact']
    }
  },
  {
    name: 'recall_facts',
    description: 'Retrieve facts from memory using semantic search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', description: 'Optional category filter' },
        limit: { type: 'number', description: 'Maximum results (default: 10)' },
        includeTeam: { type: 'boolean', description: 'Include team facts (default: true)' }
      },
      required: ['query']
    }
  },
  {
    name: 'forget_fact',
    description: 'Remove a fact from memory',
    inputSchema: {
      type: 'object',
      properties: {
        factId: { type: 'string', description: 'ID of the fact to remove' }
      },
      required: ['factId']
    }
  },
  {
    name: 'propose_team_rule',
    description: 'Propose a new rule for team approval (requires subscription)',
    inputSchema: {
      type: 'object',
      properties: {
        rule: { type: 'string', description: 'The rule to propose' },
        category: { type: 'string', description: 'Category (pattern, anti-pattern, convention)' },
        rationale: { type: 'string', description: 'Why this rule should be adopted' },
        sourceContext: { type: 'string', description: 'What triggered this proposal' }
      },
      required: ['rule']
    }
  },
  {
    name: 'get_pending_proposals',
    description: 'Get proposals awaiting approval',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'vote_proposal',
    description: 'Vote on a proposal (requires subscription)',
    inputSchema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'ID of the proposal' },
        vote: { type: 'string', enum: ['approve', 'reject'], description: 'Your vote' },
        comment: { type: 'string', description: 'Optional comment' }
      },
      required: ['proposalId', 'vote']
    }
  },
  {
    name: 'store_prd',
    description: 'Store project PRD/documentation for context retrieval',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The PRD content (markdown)' },
        projectId: { type: 'string', description: 'Project identifier' },
        sections: { type: 'array', items: { type: 'string' }, description: 'Section names to focus on' }
      },
      required: ['content']
    }
  },
  {
    name: 'get_prd_context',
    description: 'Retrieve relevant PRD context for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskDescription: { type: 'string', description: 'Description of the current task' },
        maxTokens: { type: 'number', description: 'Maximum tokens of context (default: 2000)' }
      },
      required: ['taskDescription']
    }
  },
  {
    name: 'get_memory_stats',
    description: 'Get statistics about stored memories',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

const TOOL_HANDLERS = {
  remember_fact: rememberFact,
  recall_facts: recallFacts,
  forget_fact: forgetFact,
  propose_team_rule: proposeTeamRule,
  get_pending_proposals: getPendingProposals,
  vote_proposal: voteProposal,
  store_prd: storePrd,
  get_prd_context: getPrdContext,
  get_memory_stats: getMemoryStats
};

async function main() {
  // Initialize shared database
  await memoryDb.initDatabase();

  const server = new Server(
    {
      name: 'wogi-memory-server',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }]
      };
    }

    try {
      const result = await handler(args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
        isError: true
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Wogi Memory Server v0.2.0 started (using shared database)');
}

main().catch(console.error);
