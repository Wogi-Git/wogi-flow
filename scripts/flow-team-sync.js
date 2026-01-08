#!/usr/bin/env node

/**
 * Wogi Flow - Team Sync (Project-Based)
 *
 * Synchronizes workflow knowledge between team members at the PROJECT level.
 * Unlike user-based sync, this ensures the entire team shares:
 * - decisions.md (project patterns and conventions)
 * - app-map.md (component registry)
 * - skill learnings (accumulated knowledge)
 *
 * Architecture:
 * - Each project has a unique projectId
 * - All sync happens at project scope, not user scope
 * - Conflict resolution via timestamps (newest-wins) or manual merge
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getConfig, getProjectRoot } = require('./flow-utils');

// Lazy-load to avoid circular dependency
let _syncDecisionsToRules = null;
function syncDecisionsToRules() {
  if (!_syncDecisionsToRules) {
    _syncDecisionsToRules = require('./flow-rules-sync').syncDecisionsToRules;
  }
  return _syncDecisionsToRules();
}

/**
 * Get team sync configuration
 */
function getTeamConfig() {
  const config = getConfig();
  return config.team || {};
}

/**
 * Generate a project ID from the project root path
 */
function generateProjectId() {
  const projectRoot = getProjectRoot();
  const packageJsonPath = path.join(projectRoot, 'package.json');

  let projectName = path.basename(projectRoot);

  // Try to get name from package.json
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.name) {
        projectName = pkg.name;
      }
    } catch {
      // Use directory name
    }
  }

  // Create a hash from the project name and git remote
  const gitConfigPath = path.join(projectRoot, '.git', 'config');
  let gitRemote = '';

  if (fs.existsSync(gitConfigPath)) {
    try {
      const gitConfig = fs.readFileSync(gitConfigPath, 'utf-8');
      const match = gitConfig.match(/url = (.+)/);
      if (match) {
        gitRemote = match[1];
      }
    } catch {
      // No git remote
    }
  }

  const hash = crypto.createHash('sha256')
    .update(projectName + gitRemote)
    .digest('hex')
    .substring(0, 12);

  return `proj_${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${hash}`;
}

/**
 * Get sync-able files and their content
 */
function getSyncableFiles() {
  const projectRoot = getProjectRoot();
  const teamConfig = getTeamConfig();
  const files = {};

  // Always sync decisions.md if enabled
  if (teamConfig.syncDecisions !== false) {
    const decisionsPath = path.join(projectRoot, '.workflow', 'state', 'decisions.md');
    if (fs.existsSync(decisionsPath)) {
      files.decisions = {
        path: decisionsPath,
        content: fs.readFileSync(decisionsPath, 'utf-8'),
        hash: hashContent(fs.readFileSync(decisionsPath, 'utf-8')),
        lastModified: fs.statSync(decisionsPath).mtime.toISOString()
      };
    }
  }

  // Sync app-map.md if enabled
  if (teamConfig.syncAppMap !== false) {
    const appMapPath = path.join(projectRoot, '.workflow', 'state', 'app-map.md');
    if (fs.existsSync(appMapPath)) {
      files.appMap = {
        path: appMapPath,
        content: fs.readFileSync(appMapPath, 'utf-8'),
        hash: hashContent(fs.readFileSync(appMapPath, 'utf-8')),
        lastModified: fs.statSync(appMapPath).mtime.toISOString()
      };
    }
  }

  // Sync skill learnings if enabled
  if (teamConfig.syncSkillLearnings !== false) {
    const skillsDir = path.join(projectRoot, '.claude', 'skills');
    if (fs.existsSync(skillsDir)) {
      const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('_'))
        .map(d => d.name);

      files.skillLearnings = {};

      for (const skill of skillDirs) {
        const learningsPath = path.join(skillsDir, skill, 'knowledge', 'learnings.md');
        if (fs.existsSync(learningsPath)) {
          files.skillLearnings[skill] = {
            path: learningsPath,
            content: fs.readFileSync(learningsPath, 'utf-8'),
            hash: hashContent(fs.readFileSync(learningsPath, 'utf-8')),
            lastModified: fs.statSync(learningsPath).mtime.toISOString()
          };
        }
      }
    }
  }

  // Sync component-index.json if enabled
  if (teamConfig.syncComponentIndex !== false) {
    const indexPath = path.join(projectRoot, '.workflow', 'state', 'component-index.json');
    if (fs.existsSync(indexPath)) {
      files.componentIndex = {
        path: indexPath,
        content: fs.readFileSync(indexPath, 'utf-8'),
        hash: hashContent(fs.readFileSync(indexPath, 'utf-8')),
        lastModified: fs.statSync(indexPath).mtime.toISOString()
      };
    }
  }

  // Sync request-log.md if enabled (recent entries only if configured)
  const syncRequestLog = teamConfig.syncRequestLog || teamConfig.sync?.requestLog;
  if (syncRequestLog && syncRequestLog !== false) {
    const logPath = path.join(projectRoot, '.workflow', 'state', 'request-log.md');
    if (fs.existsSync(logPath)) {
      let content = fs.readFileSync(logPath, 'utf-8');

      // If "recent" mode, only sync last 20 entries
      if (syncRequestLog === 'recent') {
        const entries = content.split(/(?=### R-\d+)/);
        const recentEntries = entries.slice(-20);
        content = recentEntries.join('');
      }

      files.requestLog = {
        path: logPath,
        content,
        hash: hashContent(content),
        lastModified: fs.statSync(logPath).mtime.toISOString(),
        mode: syncRequestLog
      };
    }
  }

  // Sync ready.json (tasks) if enabled
  if (teamConfig.syncTasks !== false && teamConfig.sync?.tasks !== false) {
    const tasksPath = path.join(projectRoot, '.workflow', 'state', 'ready.json');
    if (fs.existsSync(tasksPath)) {
      files.tasks = {
        path: tasksPath,
        content: fs.readFileSync(tasksPath, 'utf-8'),
        hash: hashContent(fs.readFileSync(tasksPath, 'utf-8')),
        lastModified: fs.statSync(tasksPath).mtime.toISOString()
      };
    }
  }

  // Sync memory database if enabled
  // Note: We export facts as JSON rather than syncing the raw SQLite file
  const syncMemory = teamConfig.syncMemory || teamConfig.sync?.memory;
  if (syncMemory) {
    const memoryDbPath = path.join(projectRoot, '.workflow', 'memory', 'local.db');
    if (fs.existsSync(memoryDbPath)) {
      try {
        // Try to export facts as JSON for safer sync
        const facts = exportMemoryFacts(memoryDbPath);
        if (facts && facts.length > 0) {
          const factsJson = JSON.stringify(facts, null, 2);
          files.memory = {
            path: memoryDbPath,
            content: factsJson,
            hash: hashContent(factsJson),
            lastModified: fs.statSync(memoryDbPath).mtime.toISOString(),
            factCount: facts.length,
            format: 'json-export'
          };
        }
      } catch (err) {
        // If export fails, note it but don't block sync
        console.warn('Memory export failed:', err.message);
      }
    }
  }

  return files;
}

/**
 * Export facts from memory database as JSON
 */
function exportMemoryFacts(dbPath) {
  try {
    // Use sqlite3 CLI to export (avoids native module dependency)
    const { execSync } = require('child_process');

    // First check what columns exist
    const schema = execSync(
      `sqlite3 "${dbPath}" "PRAGMA table_info(facts);"`,
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Parse available columns
    const columns = schema.split('\n')
      .filter(Boolean)
      .map(line => line.split('|')[1])
      .filter(Boolean);

    if (columns.length === 0) {
      return null;
    }

    // Build query with available columns
    const selectCols = columns.map(c => `'${c}', ${c}`).join(', ');
    const result = execSync(
      `sqlite3 "${dbPath}" "SELECT json_group_array(json_object(${selectCols})) FROM facts LIMIT 100"`,
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(result.trim() || '[]');
  } catch {
    // sqlite3 CLI not available or query failed - fail silently
    return null;
  }
}

/**
 * Hash content for change detection
 */
function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Create a sync payload for upload
 */
function createSyncPayload() {
  const teamConfig = getTeamConfig();
  const files = getSyncableFiles();

  return {
    projectId: teamConfig.projectId || generateProjectId(),
    teamId: teamConfig.teamId,
    timestamp: new Date().toISOString(),
    files,
    metadata: {
      version: getConfig().version || '1.0.0',
      syncedBy: teamConfig.userId || 'anonymous'
    }
  };
}

/**
 * Apply remote changes to local files
 */
function applyRemoteChanges(remotePayload, strategy = 'newest-wins') {
  const projectRoot = getProjectRoot();
  const localFiles = getSyncableFiles();
  const changes = [];

  // Apply decisions.md
  if (remotePayload.files.decisions) {
    const result = mergeFile(
      localFiles.decisions,
      remotePayload.files.decisions,
      strategy
    );
    if (result.changed) {
      fs.writeFileSync(result.path, result.content);
      // Sync to .claude/rules/ for Claude Code integration
      syncDecisionsToRules();
      changes.push({ file: 'decisions.md', action: result.action });
    }
  }

  // Apply app-map.md
  if (remotePayload.files.appMap) {
    const result = mergeFile(
      localFiles.appMap,
      remotePayload.files.appMap,
      strategy
    );
    if (result.changed) {
      fs.writeFileSync(result.path, result.content);
      changes.push({ file: 'app-map.md', action: result.action });
    }
  }

  // Apply skill learnings
  if (remotePayload.files.skillLearnings) {
    for (const [skill, remoteFile] of Object.entries(remotePayload.files.skillLearnings)) {
      const localFile = localFiles.skillLearnings?.[skill];
      const result = mergeFile(localFile, remoteFile, strategy);

      if (result.changed) {
        // Create skill directory if needed
        const skillDir = path.join(projectRoot, '.claude', 'skills', skill, 'knowledge');
        if (!fs.existsSync(skillDir)) {
          fs.mkdirSync(skillDir, { recursive: true });
        }
        fs.writeFileSync(result.path, result.content);
        changes.push({ file: `.claude/skills/${skill}/learnings.md`, action: result.action });
      }
    }
  }

  return changes;
}

/**
 * Merge a single file based on strategy
 */
function mergeFile(localFile, remoteFile, strategy) {
  const projectRoot = getProjectRoot();

  // Remote file path may be absolute from remote, need to localize
  const localPath = localFile?.path || remoteFile.path.replace(/.*\.workflow/, path.join(projectRoot, '.workflow'));

  // No local file - use remote
  if (!localFile) {
    return {
      changed: true,
      action: 'created',
      path: localPath,
      content: remoteFile.content
    };
  }

  // Same content - no change
  if (localFile.hash === remoteFile.hash) {
    return { changed: false };
  }

  // Apply strategy
  switch (strategy) {
    case 'newest-wins': {
      const localTime = new Date(localFile.lastModified).getTime();
      const remoteTime = new Date(remoteFile.lastModified).getTime();

      if (remoteTime > localTime) {
        return {
          changed: true,
          action: 'updated',
          path: localPath,
          content: remoteFile.content
        };
      }
      return { changed: false };
    }

    case 'remote-wins':
      return {
        changed: true,
        action: 'updated',
        path: localPath,
        content: remoteFile.content
      };

    case 'local-wins':
      return { changed: false };

    case 'merge':
      // For markdown files, we can do a simple append of unique sections
      const merged = mergeMarkdownContent(localFile.content, remoteFile.content);
      return {
        changed: merged !== localFile.content,
        action: 'merged',
        path: localPath,
        content: merged
      };

    default:
      return { changed: false };
  }
}

/**
 * Simple markdown merge - append unique sections
 */
function mergeMarkdownContent(localContent, remoteContent) {
  const localSections = parseSections(localContent);
  const remoteSections = parseSections(remoteContent);

  // Find sections in remote that don't exist in local
  const localHeaders = new Set(localSections.map(s => s.header.toLowerCase()));
  const newSections = remoteSections.filter(s =>
    !localHeaders.has(s.header.toLowerCase())
  );

  if (newSections.length === 0) {
    return localContent;
  }

  // Append new sections
  let merged = localContent.trimEnd();

  for (const section of newSections) {
    merged += `\n\n${section.raw}`;
  }

  return merged;
}

/**
 * Parse markdown into sections by headers
 */
function parseSections(content) {
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);

    if (headerMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        level: headerMatch[1].length,
        header: headerMatch[2],
        raw: line,
        content: []
      };
    } else if (currentSection) {
      currentSection.raw += '\n' + line;
      currentSection.content.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Get sync status
 */
function getSyncStatus() {
  const teamConfig = getTeamConfig();
  const files = getSyncableFiles();

  const status = {
    enabled: teamConfig.enabled === true,
    projectId: teamConfig.projectId || generateProjectId(),
    teamId: teamConfig.teamId,
    projectScope: teamConfig.projectScope !== false,
    lastSync: teamConfig.lastSync || null,
    files: {
      decisions: files.decisions ? {
        exists: true,
        hash: files.decisions.hash,
        lastModified: files.decisions.lastModified
      } : { exists: false },
      appMap: files.appMap ? {
        exists: true,
        hash: files.appMap.hash,
        lastModified: files.appMap.lastModified
      } : { exists: false },
      componentIndex: files.componentIndex ? {
        exists: true,
        hash: files.componentIndex.hash,
        lastModified: files.componentIndex.lastModified
      } : { exists: false },
      requestLog: files.requestLog ? {
        exists: true,
        mode: files.requestLog.mode,
        lastModified: files.requestLog.lastModified
      } : { exists: false },
      tasks: files.tasks ? {
        exists: true,
        hash: files.tasks.hash,
        lastModified: files.tasks.lastModified
      } : { exists: false },
      memory: files.memory ? {
        exists: true,
        factCount: files.memory.factCount,
        lastModified: files.memory.lastModified
      } : { exists: false },
      skillLearnings: files.skillLearnings ? Object.keys(files.skillLearnings) : []
    },
    syncConfig: {
      syncDecisions: teamConfig.syncDecisions !== false,
      syncAppMap: teamConfig.syncAppMap !== false,
      syncComponentIndex: teamConfig.syncComponentIndex !== false,
      syncSkillLearnings: teamConfig.syncSkillLearnings !== false,
      syncRequestLog: teamConfig.syncRequestLog || 'recent',
      syncTasks: teamConfig.syncTasks || false,
      syncMemory: teamConfig.syncMemory || false,
      conflictResolution: teamConfig.conflictResolution || 'newest-wins'
    }
  };

  return status;
}

/**
 * Initialize team sync for a project
 */
function initializeTeamSync(teamId, options = {}) {
  const projectRoot = getProjectRoot();
  const configPath = path.join(projectRoot, '.workflow', 'config.json');

  const config = getConfig();

  config.team = {
    ...config.team,
    enabled: true,
    teamId,
    projectId: options.projectId || generateProjectId(),
    projectScope: true,
    syncDecisions: options.syncDecisions !== false,
    syncAppMap: options.syncAppMap !== false,
    syncSkillLearnings: options.syncSkillLearnings !== false,
    conflictResolution: options.conflictResolution || 'newest-wins',
    lastSync: null
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  return {
    success: true,
    projectId: config.team.projectId,
    message: `Team sync initialized for project ${config.team.projectId}`
  };
}

/**
 * Sync with backend (placeholder for actual API call)
 */
async function syncWithBackend() {
  const teamConfig = getTeamConfig();

  if (!teamConfig.enabled) {
    return { success: false, message: 'Team sync not enabled' };
  }

  const payload = createSyncPayload();

  // In a real implementation, this would call the API
  // For now, save to a local sync file for testing
  const projectRoot = getProjectRoot();
  const syncDir = path.join(projectRoot, '.workflow', 'sync');

  if (!fs.existsSync(syncDir)) {
    fs.mkdirSync(syncDir, { recursive: true });
  }

  const syncFile = path.join(syncDir, `sync-${Date.now()}.json`);
  fs.writeFileSync(syncFile, JSON.stringify(payload, null, 2));

  // Update last sync time
  const configPath = path.join(projectRoot, '.workflow', 'config.json');
  const config = getConfig();
  config.team.lastSync = new Date().toISOString();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  return {
    success: true,
    message: 'Sync payload created',
    syncFile,
    filesIncluded: Object.keys(payload.files)
  };
}

/**
 * Generate sync status report
 */
function generateStatusReport() {
  const status = getSyncStatus();
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════╗',
    '║            🔄 TEAM SYNC STATUS                       ║',
    '╠══════════════════════════════════════════════════════╣'
  ];

  const enabledIcon = status.enabled ? '✅' : '❌';
  lines.push(`║  Status: ${enabledIcon} ${status.enabled ? 'Enabled' : 'Disabled'}`.padEnd(55) + '║');
  lines.push(`║  Project ID: ${(status.projectId || 'Not set').substring(0, 35)}`.padEnd(55) + '║');
  lines.push(`║  Team ID: ${status.teamId || 'Not set'}`.padEnd(55) + '║');
  lines.push(`║  Scope: ${status.projectScope ? 'Project-based' : 'User-based'}`.padEnd(55) + '║');

  lines.push('╠══════════════════════════════════════════════════════╣');
  lines.push('║  Syncable Files:'.padEnd(55) + '║');

  const dIcon = status.files.decisions?.exists ? '✅' : '❌';
  const dEnabled = status.syncConfig.syncDecisions ? '' : ' (disabled)';
  lines.push(`║    ${dIcon} decisions.md${dEnabled}`.padEnd(55) + '║');

  const aIcon = status.files.appMap?.exists ? '✅' : '❌';
  const aEnabled = status.syncConfig.syncAppMap ? '' : ' (disabled)';
  lines.push(`║    ${aIcon} app-map.md${aEnabled}`.padEnd(55) + '║');

  const cIcon = status.files.componentIndex?.exists ? '✅' : '❌';
  const cEnabled = status.syncConfig.syncComponentIndex ? '' : ' (disabled)';
  lines.push(`║    ${cIcon} component-index.json${cEnabled}`.padEnd(55) + '║');

  const rIcon = status.files.requestLog?.exists ? '✅' : '❌';
  const rMode = status.syncConfig.syncRequestLog === 'recent' ? ' (recent)' : '';
  const rEnabled = status.syncConfig.syncRequestLog ? rMode : ' (disabled)';
  lines.push(`║    ${rIcon} request-log.md${rEnabled}`.padEnd(55) + '║');

  const tIcon = status.files.tasks?.exists ? '✅' : '❌';
  const tEnabled = status.syncConfig.syncTasks ? '' : ' (disabled)';
  lines.push(`║    ${tIcon} ready.json (tasks)${tEnabled}`.padEnd(55) + '║');

  const mIcon = status.files.memory?.exists ? '✅' : '❌';
  const mCount = status.files.memory?.factCount ? ` (${status.files.memory.factCount} facts)` : '';
  const mEnabled = status.syncConfig.syncMemory ? mCount : ' (disabled)';
  lines.push(`║    ${mIcon} memory facts${mEnabled}`.padEnd(55) + '║');

  const skillCount = status.files.skillLearnings?.length || 0;
  const sEnabled = status.syncConfig.syncSkillLearnings ? '' : ' (disabled)';
  lines.push(`║    📚 ${skillCount} skill learning files${sEnabled}`.padEnd(55) + '║');

  lines.push('╠══════════════════════════════════════════════════════╣');
  lines.push(`║  Conflict Resolution: ${status.syncConfig.conflictResolution}`.padEnd(55) + '║');
  lines.push(`║  Last Sync: ${status.lastSync || 'Never'}`.padEnd(55) + '║');
  lines.push('╚══════════════════════════════════════════════════════╝');

  return lines.join('\n');
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  getTeamConfig,
  generateProjectId,
  getSyncableFiles,
  createSyncPayload,
  applyRemoteChanges,
  getSyncStatus,
  initializeTeamSync,
  syncWithBackend,
  generateStatusReport,
  hashContent,
  mergeMarkdownContent
};

// ============================================================
// CLI
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status': {
      console.log(generateStatusReport());
      break;
    }

    case 'init': {
      const teamId = args[1];
      if (!teamId) {
        console.error('Usage: node flow-team-sync.js init <team-id>');
        process.exit(1);
      }

      const result = initializeTeamSync(teamId);
      console.log(`\n✅ ${result.message}`);
      console.log(`   Project ID: ${result.projectId}`);
      break;
    }

    case 'sync': {
      syncWithBackend().then(result => {
        if (result.success) {
          console.log(`\n✅ ${result.message}`);
          console.log(`   Files: ${result.filesIncluded.join(', ')}`);
        } else {
          console.error(`\n❌ ${result.message}`);
          process.exit(1);
        }
      });
      break;
    }

    case 'payload': {
      const payload = createSyncPayload();
      console.log(JSON.stringify(payload, null, 2));
      break;
    }

    case 'project-id': {
      console.log(generateProjectId());
      break;
    }

    default:
      console.log(`
Wogi Flow - Team Sync (Project-Based)

Usage:
  node flow-team-sync.js <command> [args]

Commands:
  status              Show sync status
  init <team-id>      Initialize team sync
  sync                Sync with backend
  payload             Show sync payload (debug)
  project-id          Generate/show project ID

Configuration (config.json):
  team.enabled: true
  team.projectScope: true        (project-based, not user-based)
  team.syncDecisions: true       Sync decisions.md
  team.syncAppMap: true          Sync app-map.md
  team.syncSkillLearnings: true  Sync skill learnings
  team.conflictResolution: "newest-wins" | "remote-wins" | "local-wins" | "merge"
`);
  }
}
