#!/usr/bin/env node

/**
 * Wogi Flow - Team Collaboration Module
 *
 * Manages team features including:
 * - Team login/logout with invite codes
 * - Setup selection from team configurations
 * - Knowledge sync with cloud backend
 * - Proposal management for team rules
 *
 * Part of v1.8.0 Team Collaboration
 *
 * Note: Team features require a subscription and hosted backend.
 * Without subscription, features gracefully degrade to local-only mode.
 */

const fs = require('fs');
const path = require('path');
const {
  getConfig,
  saveConfig,
  STATE_DIR,
  PATHS,
  colors,
  color,
  success,
  warn,
  error,
  info,
  printHeader,
  fileExists,
  readFile,
  writeFile
} = require('./flow-utils');

// ============================================================
// Constants
// ============================================================

const TEAM_STATE_FILE = path.join(STATE_DIR, 'team-state.json');
const PROPOSALS_DIR = path.join(STATE_DIR, 'proposals');
const DEFAULT_BACKEND_URL = 'https://api.wogi-flow.com';

// ============================================================
// Team State Management
// ============================================================

/**
 * Get current team state
 */
function getTeamState() {
  if (!fileExists(TEAM_STATE_FILE)) {
    return {
      loggedIn: false,
      teamId: null,
      userId: null,
      teamName: null,
      setupId: null,
      setupName: null,
      lastSync: null,
      token: null
    };
  }

  try {
    return JSON.parse(readFile(TEAM_STATE_FILE));
  } catch (e) {
    return { loggedIn: false };
  }
}

/**
 * Save team state
 */
function saveTeamState(state) {
  writeFile(TEAM_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Check if team features are enabled and configured
 */
function isTeamEnabled() {
  const config = getConfig();
  return config.team?.enabled === true && config.team?.teamId;
}

/**
 * Get backend URL from config or default
 */
function getBackendUrl() {
  const config = getConfig();
  return config.team?.backendUrl || DEFAULT_BACKEND_URL;
}

// ============================================================
// API Client (with graceful degradation)
// ============================================================

/**
 * Make authenticated request to backend
 */
async function apiRequest(endpoint, options = {}) {
  const state = getTeamState();
  const backendUrl = getBackendUrl();

  const url = `${backendUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...options.headers
  };

  try {
    // Dynamic import for fetch (Node 18+)
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401) {
      return { error: 'unauthorized', message: 'Team subscription required or token expired' };
    }

    if (response.status === 403) {
      return { error: 'forbidden', message: 'Access denied' };
    }

    if (!response.ok) {
      const text = await response.text();
      return { error: 'api_error', message: text, status: response.status };
    }

    return await response.json();
  } catch (e) {
    // Network error or backend unavailable
    return { error: 'network', message: `Backend unavailable: ${e.message}` };
  }
}

// ============================================================
// Team Commands
// ============================================================

/**
 * Login to team with invite code
 */
async function login(inviteCode) {
  printHeader('Team Login');

  if (!inviteCode) {
    // Show login options
    console.log('To join a team, you need an invite code from your team admin.');
    console.log('');
    console.log('Options:');
    console.log('  1. Join existing team: ./scripts/flow team login <invite-code>');
    console.log('  2. Create new team:    Visit https://wogi-flow.com/teams/new');
    console.log('');
    info('Team features require a subscription at https://wogi-flow.com');
    return;
  }

  info('Validating invite code...');

  const result = await apiRequest('/api/teams/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode })
  });

  if (result.error) {
    if (result.error === 'network') {
      error('Could not connect to team backend.');
      info('Team features require an active subscription.');
      info('Visit https://wogi-flow.com to get started.');
    } else if (result.error === 'unauthorized') {
      error('Invalid or expired invite code.');
    } else {
      error(`Login failed: ${result.message}`);
    }
    return;
  }

  // Save team state
  const teamState = {
    loggedIn: true,
    teamId: result.teamId,
    userId: result.userId,
    teamName: result.teamName,
    token: result.token,
    setupId: null,
    setupName: null,
    lastSync: null
  };
  saveTeamState(teamState);

  // Update config
  const config = getConfig();
  config.team = {
    ...config.team,
    enabled: true,
    teamId: result.teamId,
    userId: result.userId
  };
  saveConfig(config);

  success(`Logged in to team: ${result.teamName}`);
  console.log('');

  // Show available setups
  if (result.setups && result.setups.length > 0) {
    console.log('Available setups:');
    result.setups.forEach((setup, i) => {
      console.log(`  ${i + 1}. ${setup.name} - ${setup.description || 'No description'}`);
    });
    console.log('');
    info('Select a setup with: ./scripts/flow team setup <number>');
  } else {
    info('No team setups available. Contact your team admin.');
  }
}

/**
 * Logout from team
 */
async function logout() {
  printHeader('Team Logout');

  const state = getTeamState();

  if (!state.loggedIn) {
    warn('Not logged in to any team.');
    return;
  }

  const teamName = state.teamName || 'team';

  // Clear team state
  saveTeamState({
    loggedIn: false,
    teamId: null,
    userId: null,
    teamName: null,
    setupId: null,
    setupName: null,
    lastSync: null,
    token: null
  });

  // Update config (keep structure, disable)
  const config = getConfig();
  config.team = {
    ...config.team,
    enabled: false
  };
  saveConfig(config);

  success(`Logged out from ${teamName}`);
  info('Local data preserved. Team features disabled.');
}

/**
 * Select team setup
 */
async function selectSetup(setupIndex) {
  printHeader('Team Setup');

  const state = getTeamState();

  if (!state.loggedIn) {
    error('Not logged in to a team. Run: ./scripts/flow team login <invite-code>');
    return;
  }

  if (!setupIndex) {
    // List available setups
    info('Fetching available setups...');

    const result = await apiRequest(`/api/teams/${state.teamId}/setups`);

    if (result.error) {
      error(`Failed to fetch setups: ${result.message}`);
      return;
    }

    if (!result.setups || result.setups.length === 0) {
      warn('No setups available for this team.');
      return;
    }

    console.log('');
    console.log('Available setups:');
    result.setups.forEach((setup, i) => {
      const current = setup.id === state.setupId ? color('green', ' (current)') : '';
      console.log(`  ${i + 1}. ${setup.name}${current}`);
      if (setup.description) {
        console.log(color('dim', `     ${setup.description}`));
      }
    });
    console.log('');
    info('Select with: ./scripts/flow team setup <number>');
    return;
  }

  // Fetch and apply setup
  info('Applying setup...');

  const result = await apiRequest(`/api/teams/${state.teamId}/setups/${setupIndex}/apply`, {
    method: 'POST'
  });

  if (result.error) {
    error(`Failed to apply setup: ${result.message}`);
    return;
  }

  // Update team state
  state.setupId = result.setupId;
  state.setupName = result.setupName;
  saveTeamState(state);

  // Merge setup config into local config
  if (result.config) {
    const config = getConfig();
    const merged = deepMerge(config, result.config);
    // Preserve project-specific values
    merged.projectName = config.projectName;
    merged.skills.installed = config.skills?.installed || [];
    saveConfig(merged);
  }

  success(`Setup applied: ${result.setupName}`);

  // Trigger initial sync
  await sync();
}

/**
 * Sync with team backend
 */
async function sync(options = {}) {
  printHeader('Team Sync');

  const state = getTeamState();

  if (!state.loggedIn) {
    error('Not logged in to a team.');
    return { pulled: 0, pushed: 0 };
  }

  const { silent = false } = options;

  if (!silent) info('Syncing with team...');

  // 1. Push local proposals
  const proposals = getLocalProposals();
  let pushed = 0;

  for (const proposal of proposals) {
    if (proposal.synced) continue;

    const result = await apiRequest('/api/proposals', {
      method: 'POST',
      body: JSON.stringify(proposal)
    });

    if (!result.error) {
      proposal.synced = true;
      proposal.remoteId = result.id;
      saveProposal(proposal);
      pushed++;
    }
  }

  // 2. Pull new approved knowledge
  const pullResult = await apiRequest(`/api/teams/${state.teamId}/knowledge`, {
    method: 'GET',
    headers: {
      'X-Last-Sync': state.lastSync || '1970-01-01T00:00:00Z'
    }
  });

  let pulled = 0;
  if (!pullResult.error && pullResult.knowledge) {
    // Import new knowledge to local memory
    const { storeByRoute } = require('./flow-knowledge-router');

    for (const item of pullResult.knowledge) {
      await storeByRoute(item.fact, {
        type: item.type || 'project',
        skill: item.skill,
        model: item.model
      }, {
        source: 'team-sync',
        teamId: state.teamId
      });
      pulled++;
    }
  }

  // Update last sync time
  state.lastSync = new Date().toISOString();
  saveTeamState(state);

  if (!silent) {
    success(`Sync complete: ${pulled} pulled, ${pushed} pushed`);
  }

  return { pulled, pushed };
}

/**
 * Show/vote on team proposals
 */
async function proposals(action, proposalId, vote) {
  printHeader('Team Proposals');

  const state = getTeamState();

  if (!state.loggedIn) {
    error('Not logged in to a team.');
    return;
  }

  if (action === 'vote' && proposalId && vote) {
    // Vote on proposal
    const result = await apiRequest(`/api/proposals/${proposalId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote, comment: '' })
    });

    if (result.error) {
      error(`Failed to vote: ${result.message}`);
      return;
    }

    success(`Vote recorded: ${vote} on proposal #${proposalId}`);
    return;
  }

  // List pending proposals
  const result = await apiRequest(`/api/teams/${state.teamId}/proposals?status=pending`);

  if (result.error) {
    error(`Failed to fetch proposals: ${result.message}`);
    return;
  }

  if (!result.proposals || result.proposals.length === 0) {
    info('No pending proposals.');
    return;
  }

  console.log('');
  console.log('Pending proposals:');
  console.log('');

  for (const p of result.proposals) {
    console.log(`  #${p.id} | ${p.category} | by ${p.proposer}`);
    console.log(color('dim', '  ' + '─'.repeat(50)));
    console.log(`  Rule: "${p.rule}"`);
    if (p.rationale) {
      console.log(color('dim', `  Rationale: ${p.rationale}`));
    }
    console.log(`  Votes: ${p.approves} approve, ${p.rejects} reject`);
    console.log('');
  }

  info('Vote with: ./scripts/flow team proposals vote <id> <approve|reject>');
}

/**
 * Generate invite code (admin only)
 */
async function invite() {
  printHeader('Generate Invite');

  const state = getTeamState();

  if (!state.loggedIn) {
    error('Not logged in to a team.');
    return;
  }

  const result = await apiRequest(`/api/teams/${state.teamId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ expiresInDays: 7 })
  });

  if (result.error) {
    if (result.error === 'forbidden') {
      error('Only team admins can generate invite codes.');
    } else {
      error(`Failed to generate invite: ${result.message}`);
    }
    return;
  }

  console.log('');
  console.log('Invite code generated:');
  console.log('');
  console.log(`  ${color('green', result.code)}`);
  console.log('');
  console.log(`Valid for: ${result.expiresInDays} days`);
  console.log('');
  info('Share this code with team members to join.');
}

/**
 * Show team status
 */
function status() {
  printHeader('Team Status');

  const state = getTeamState();
  const config = getConfig();

  if (!state.loggedIn) {
    console.log('Status: ' + color('yellow', 'Not logged in'));
    console.log('');
    info('Join a team: ./scripts/flow team login <invite-code>');
    info('Learn more: https://wogi-flow.com/teams');
    return;
  }

  console.log('Status: ' + color('green', 'Logged in'));
  console.log('');
  console.log(`Team:     ${state.teamName || state.teamId}`);
  console.log(`Setup:    ${state.setupName || 'None selected'}`);
  console.log(`Last sync: ${state.lastSync || 'Never'}`);
  console.log('');

  // Show local proposals
  const localProposals = getLocalProposals();
  const unsynced = localProposals.filter(p => !p.synced).length;

  if (unsynced > 0) {
    warn(`${unsynced} unsynced proposal(s). Run: ./scripts/flow team sync`);
  }

  // Show config status
  console.log('Configuration:');
  console.log(`  Auto-sync: ${config.team?.autoSync ? 'Enabled' : 'Disabled'}`);
  console.log(`  Sync interval: ${Math.round((config.team?.syncInterval || 300000) / 60000)} minutes`);
}

// ============================================================
// Local Proposals
// ============================================================

function getLocalProposals() {
  if (!fs.existsSync(PROPOSALS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(PROPOSALS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(PROPOSALS_DIR, f), 'utf-8'));
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

function saveProposal(proposal) {
  if (!fs.existsSync(PROPOSALS_DIR)) {
    fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
  }

  const filename = `${proposal.id}.json`;
  fs.writeFileSync(
    path.join(PROPOSALS_DIR, filename),
    JSON.stringify(proposal, null, 2)
  );
}

// ============================================================
// Utilities
// ============================================================

function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// ============================================================
// CLI
// ============================================================

function printUsage() {
  console.log(`
Wogi Flow - Team Collaboration

Usage: ./scripts/flow team <command> [args]

Commands:
  login <code>          Join team with invite code
  logout                Leave current team
  setup [number]        List or select team setup
  sync                  Sync knowledge with team
  proposals             List pending proposals
  proposals vote <id> <approve|reject>
                        Vote on a proposal
  invite                Generate invite code (admin)
  status                Show team status

Examples:
  ./scripts/flow team login ABC123
  ./scripts/flow team setup 1
  ./scripts/flow team sync
  ./scripts/flow team proposals vote 42 approve

Team features require a subscription at https://wogi-flow.com
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'login':
      await login(args[1]);
      break;

    case 'logout':
      await logout();
      break;

    case 'setup':
      await selectSetup(args[1]);
      break;

    case 'sync':
      await sync();
      break;

    case 'proposals':
      await proposals(args[1], args[2], args[3]);
      break;

    case 'invite':
      await invite();
      break;

    case 'status':
      status();
      break;

    case '--help':
    case '-h':
    case 'help':
      printUsage();
      break;

    default:
      if (command) {
        error(`Unknown command: ${command}`);
      }
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  getTeamState,
  saveTeamState,
  isTeamEnabled,
  login,
  logout,
  selectSetup,
  sync,
  proposals,
  invite,
  status,
  getLocalProposals,
  saveProposal
};

if (require.main === module) {
  main().catch(e => {
    error(`Error: ${e.message}`);
    process.exit(1);
  });
}
