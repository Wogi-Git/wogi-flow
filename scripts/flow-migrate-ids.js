#!/usr/bin/env node

/**
 * Wogi Flow - ID Migration Script
 *
 * Migrates legacy TASK-XXX and BUG-XXX IDs to new hash-based wf-XXXXXXXX format.
 * This is a one-time migration script for upgrading from v1.8 to v1.9.
 *
 * Usage:
 *   node scripts/flow-migrate-ids.js [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run   Show what would be changed without making changes
 *   --verbose   Show detailed progress
 */

const fs = require('fs');
const path = require('path');
const {
  PATHS,
  PROJECT_ROOT,
  fileExists,
  dirExists,
  readJson,
  writeJson,
  readFile,
  writeFile,
  generateTaskId,
  isLegacyTaskId,
  parseFlags,
  color,
  success,
  warn,
  info,
  error,
  printHeader
} = require('./flow-utils');

// Parse arguments
const { flags } = parseFlags(process.argv.slice(2));
const DRY_RUN = flags.dryRun || flags['dry-run'];
const VERBOSE = flags.verbose;

// Track all ID mappings for cross-file consistency
const idMapping = new Map();

/**
 * Generate a new ID for a legacy ID, maintaining mapping consistency
 */
function getNewId(legacyId, title = '') {
  if (idMapping.has(legacyId)) {
    return idMapping.get(legacyId);
  }

  const newId = generateTaskId(title || legacyId);
  idMapping.set(legacyId, newId);
  return newId;
}

/**
 * Migrate ready.json
 */
function migrateReadyJson() {
  if (!fileExists(PATHS.ready)) {
    if (VERBOSE) info('ready.json not found, skipping');
    return { migrated: 0, file: 'ready.json' };
  }

  const data = readJson(PATHS.ready, {});
  let migrated = 0;

  const lists = ['ready', 'inProgress', 'blocked', 'recentlyCompleted'];

  for (const listName of lists) {
    const list = data[listName] || [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];

      // Handle both string IDs and object tasks
      if (typeof item === 'string' && isLegacyTaskId(item)) {
        const newId = getNewId(item);
        list[i] = {
          id: newId,
          title: item,
          legacyId: item,
          priority: 'P2',
          createdAt: new Date().toISOString()
        };
        migrated++;
        if (VERBOSE) console.log(`  ${item} → ${newId}`);
      } else if (typeof item === 'object' && item.id && isLegacyTaskId(item.id)) {
        const newId = getNewId(item.id, item.title);
        item.legacyId = item.id;
        item.id = newId;
        item.priority = item.priority || 'P2';
        migrated++;
        if (VERBOSE) console.log(`  ${item.legacyId} → ${newId}`);
      }
    }
    data[listName] = list;
  }

  if (migrated > 0 && !DRY_RUN) {
    writeJson(PATHS.ready, data);
  }

  return { migrated, file: 'ready.json' };
}

/**
 * Migrate bugs directory
 */
function migrateBugsDirectory() {
  const bugsDir = PATHS.bugs;
  if (!dirExists(bugsDir)) {
    if (VERBOSE) info('bugs directory not found, skipping');
    return { migrated: 0, file: '.workflow/bugs/' };
  }

  const files = fs.readdirSync(bugsDir).filter(f => f.match(/^BUG-\d+\.md$/));
  let migrated = 0;

  for (const file of files) {
    const legacyId = file.replace('.md', '');
    const filePath = path.join(bugsDir, file);
    const content = readFile(filePath, '');

    // Extract title from content
    const titleMatch = content.match(/^# BUG-\d+:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1] : legacyId;

    const newId = getNewId(legacyId, title);
    const newFileName = `${newId}.md`;
    const newFilePath = path.join(bugsDir, newFileName);

    // Update content - replace all occurrences of the legacy ID
    let newContent = content
      .replace(new RegExp(legacyId, 'g'), newId)
      .replace(/^# wf-[a-f0-9]{8}:/, `# ${newId}:`);

    // Add legacy ID reference if not present
    if (!newContent.includes('**Legacy ID**')) {
      newContent = newContent.replace(
        /(\*\*Created\*\*:.+)/,
        `$1\n**Legacy ID**: ${legacyId}`
      );
    }

    if (!DRY_RUN) {
      try {
        writeFile(newFilePath, newContent);
        // Only delete original after successful write
        fs.unlinkSync(filePath);
      } catch (err) {
        error(`Failed to migrate ${file}: ${err.message}`);
        // Don't delete original - migration failed
        continue;
      }
    }

    migrated++;
    if (VERBOSE) console.log(`  ${file} → ${newFileName}`);
  }

  return { migrated, file: '.workflow/bugs/' };
}

/**
 * Migrate changes directory (feature/story files)
 */
function migrateChangesDirectory() {
  const changesDir = PATHS.changes;
  if (!dirExists(changesDir)) {
    if (VERBOSE) info('changes directory not found, skipping');
    return { migrated: 0, file: '.workflow/changes/' };
  }

  const files = fs.readdirSync(changesDir).filter(f => f.match(/^TASK-\d+/));
  let migrated = 0;

  for (const file of files) {
    const legacyIdMatch = file.match(/^(TASK-\d+)/);
    if (!legacyIdMatch) continue;

    const legacyId = legacyIdMatch[1];
    const filePath = path.join(changesDir, file);
    const content = readFile(filePath, '');

    // Extract title from content
    const titleMatch = content.match(/^# \[TASK-\d+\]\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1] : legacyId;

    const newId = getNewId(legacyId, title);
    const newFileName = file.replace(legacyId, newId);
    const newFilePath = path.join(changesDir, newFileName);

    // Update content
    let newContent = content.replace(new RegExp(legacyId, 'g'), newId);

    // Add legacy ID reference
    if (!newContent.includes('**Legacy ID**')) {
      newContent = newContent.replace(
        /(\*\*Created\*\*:.+)/,
        `$1\n**Legacy ID**: ${legacyId}`
      );
    }

    if (!DRY_RUN) {
      try {
        writeFile(newFilePath, newContent);
        // Only delete original after successful write
        if (newFilePath !== filePath) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        error(`Failed to migrate ${file}: ${err.message}`);
        // Don't delete original - migration failed
        continue;
      }
    }

    migrated++;
    if (VERBOSE) console.log(`  ${file} → ${newFileName}`);
  }

  return { migrated, file: '.workflow/changes/' };
}

/**
 * Migrate request-log.md (update references)
 */
function migrateRequestLog() {
  if (!fileExists(PATHS.requestLog)) {
    if (VERBOSE) info('request-log.md not found, skipping');
    return { migrated: 0, file: 'request-log.md' };
  }

  let content = readFile(PATHS.requestLog, '');
  let migrated = 0;

  // Replace all legacy ID references with new IDs from our mapping
  for (const [legacyId, newId] of idMapping.entries()) {
    const regex = new RegExp(`\\b${legacyId}\\b`, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newId);
      migrated += matches.length;
      if (VERBOSE) console.log(`  Replaced ${matches.length} references: ${legacyId} → ${newId}`);
    }
  }

  if (migrated > 0 && !DRY_RUN) {
    writeFile(PATHS.requestLog, content);
  }

  return { migrated, file: 'request-log.md' };
}

/**
 * Migrate progress.md (update references)
 */
function migrateProgressMd() {
  if (!fileExists(PATHS.progress)) {
    if (VERBOSE) info('progress.md not found, skipping');
    return { migrated: 0, file: 'progress.md' };
  }

  let content = readFile(PATHS.progress, '');
  let migrated = 0;

  for (const [legacyId, newId] of idMapping.entries()) {
    const regex = new RegExp(`\\b${legacyId}\\b`, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newId);
      migrated += matches.length;
    }
  }

  if (migrated > 0 && !DRY_RUN) {
    writeFile(PATHS.progress, content);
  }

  return { migrated, file: 'progress.md' };
}

/**
 * Save ID mapping for reference
 */
function saveIdMapping() {
  if (idMapping.size === 0) return;

  const mappingPath = path.join(PATHS.state, 'id-migration-map.json');
  const mappingData = {
    migratedAt: new Date().toISOString(),
    mappings: Object.fromEntries(idMapping)
  };

  if (!DRY_RUN) {
    writeJson(mappingPath, mappingData);
    success(`ID mapping saved to ${mappingPath}`);
  }
}

/**
 * Main migration function
 */
function main() {
  printHeader('Wogi Flow ID Migration');

  if (DRY_RUN) {
    warn('DRY RUN MODE - No changes will be made\n');
  }

  const results = [];

  // Run migrations in order (files first, then references)
  console.log(color('cyan', '\nMigrating task files...'));
  results.push(migrateReadyJson());
  results.push(migrateBugsDirectory());
  results.push(migrateChangesDirectory());

  console.log(color('cyan', '\nUpdating references...'));
  results.push(migrateRequestLog());
  results.push(migrateProgressMd());

  // Save mapping
  saveIdMapping();

  // Summary
  console.log(color('cyan', '\n═══════════════════════════════════════════════'));
  console.log(color('cyan', '                 MIGRATION SUMMARY'));
  console.log(color('cyan', '═══════════════════════════════════════════════\n'));

  let totalMigrated = 0;
  for (const result of results) {
    if (result.migrated > 0) {
      console.log(`  ${color('green', '✓')} ${result.file}: ${result.migrated} items`);
      totalMigrated += result.migrated;
    } else {
      console.log(`  ${color('dim', '○')} ${result.file}: no changes`);
    }
  }

  console.log('');
  if (totalMigrated > 0) {
    if (DRY_RUN) {
      warn(`Would migrate ${totalMigrated} items. Run without --dry-run to apply.`);
    } else {
      success(`Migration complete: ${totalMigrated} items migrated`);
    }
  } else {
    info('No legacy IDs found. Migration not needed.');
  }

  // Show ID mapping
  if (idMapping.size > 0 && VERBOSE) {
    console.log(color('cyan', '\nID Mappings:'));
    for (const [legacyId, newId] of idMapping.entries()) {
      console.log(`  ${legacyId} → ${newId}`);
    }
  }
}

// Run only when executed directly
if (require.main === module) {
  main();
}

module.exports = { main };
