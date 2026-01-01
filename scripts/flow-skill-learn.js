#!/usr/bin/env node

/**
 * Wogi Flow - Skill Learning Engine
 *
 * Extracts learnings from work and updates skills automatically.
 * Called by:
 *   - Pre-commit hook (--trigger=commit)
 *   - Task completion (--trigger=task)
 *   - Context compaction (--trigger=compact)
 *   - Manual invocation (--trigger=manual)
 *
 * Usage:
 *   flow skill-learn                    # Auto-detect trigger
 *   flow skill-learn --trigger=commit   # Called from pre-commit
 *   flow skill-learn --skill=nestjs     # Target specific skill
 *   flow skill-learn --dry-run          # Show what would be updated
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getProjectRoot } = require('./flow-utils');

const PROJECT_ROOT = getProjectRoot();
const WORKFLOW_DIR = path.join(PROJECT_ROOT, '.workflow');
const SKILLS_DIR = path.join(PROJECT_ROOT, 'skills');
const STATE_DIR = path.join(WORKFLOW_DIR, 'state');

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

function log(color, ...args) {
  console.log(colors[color] + args.join(' ') + colors.reset);
}

// ============================================================
// Configuration
// ============================================================

function loadConfig() {
  const configPath = path.join(WORKFLOW_DIR, 'config.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function isLearningEnabled(config, trigger) {
  if (!config?.skillLearning?.enabled) return false;
  if (!config?.skillLearning?.autoExtract) return false;

  const triggers = config.skillLearning.triggers || {};
  switch (trigger) {
    case 'commit': return triggers.onCommit !== false;
    case 'task': return triggers.onTaskComplete !== false;
    case 'compact': return triggers.onCompact !== false;
    case 'manual': return true;
    default: return true;
  }
}

// ============================================================
// Skill Discovery
// ============================================================

function discoverSkills() {
  const skills = [];

  if (!fs.existsSync(SKILLS_DIR)) {
    return skills;
  }

  const dirs = fs.readdirSync(SKILLS_DIR);

  for (const dir of dirs) {
    if (dir.startsWith('_')) continue; // Skip templates

    const skillPath = path.join(SKILLS_DIR, dir);
    const skillMdPath = path.join(skillPath, 'skill.md');
    const legacySkillMdPath = path.join(skillPath, 'SKILL.md');

    if (fs.statSync(skillPath).isDirectory()) {
      const mdPath = fs.existsSync(skillMdPath) ? skillMdPath :
                     fs.existsSync(legacySkillMdPath) ? legacySkillMdPath : null;

      if (mdPath) {
        const content = fs.readFileSync(mdPath, 'utf-8');
        const skill = parseSkillMd(content, dir, skillPath);
        skills.push(skill);
      }
    }
  }

  return skills;
}

function parseSkillMd(content, name, skillPath) {
  const skill = {
    name,
    path: skillPath,
    version: '1.0.0',
    description: '',
    filePatterns: [],
    hasKnowledge: fs.existsSync(path.join(skillPath, 'knowledge'))
  };

  // Parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1];
    const versionMatch = yaml.match(/version:\s*["']?([^"'\n]+)/);
    const descMatch = yaml.match(/description:\s*["']?([^"'\n]+)/);

    if (versionMatch) skill.version = versionMatch[1].trim();
    if (descMatch) skill.description = descMatch[1].trim();
  }

  // Extract file patterns
  const patternsMatch = content.match(/## File Patterns[\s\S]*?(?=\n## |$)/);
  if (patternsMatch) {
    const patterns = patternsMatch[0].match(/`([^`]+)`/g);
    if (patterns) {
      skill.filePatterns = patterns.map(p => p.replace(/`/g, ''));
    }
  }

  // Infer patterns from skill name if none found
  if (skill.filePatterns.length === 0) {
    const inferredPatterns = {
      'nestjs': ['*.module.ts', '*.controller.ts', '*.service.ts', '*.entity.ts'],
      'react': ['*.tsx', '*.jsx', 'use*.ts'],
      'python': ['*.py'],
      'typescript': ['*.ts', '*.tsx']
    };
    skill.filePatterns = inferredPatterns[name] || [];
  }

  return skill;
}

// ============================================================
// Change Analysis
// ============================================================

function getChangedFiles(staged = false) {
  try {
    const cmd = staged
      ? 'git diff --cached --name-only'
      : 'git diff HEAD --name-only';
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return output.trim().split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

function getRecentCommitFiles(count = 1) {
  try {
    const cmd = `git diff HEAD~${count} --name-only`;
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return output.trim().split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

function matchFilesToSkills(files, skills) {
  const matches = new Map(); // skill -> files
  const unmatched = [];

  for (const file of files) {
    let matched = false;

    for (const skill of skills) {
      for (const pattern of skill.filePatterns) {
        if (matchPattern(file, pattern)) {
          if (!matches.has(skill.name)) {
            matches.set(skill.name, []);
          }
          matches.get(skill.name).push(file);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      unmatched.push(file);
    }
  }

  return { matches, unmatched };
}

function matchPattern(file, pattern) {
  // Simple glob matching
  const regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(regex).test(file);
}

// ============================================================
// Learning Extraction
// ============================================================

function extractLearningContext(files, trigger) {
  const context = {
    trigger,
    timestamp: new Date().toISOString(),
    files,
    summary: '',
    type: 'observation' // observation | correction | pattern | anti-pattern
  };

  // Try to get commit message for context
  if (trigger === 'commit') {
    try {
      const msg = execSync('git log -1 --format=%B', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      context.summary = msg.trim().split('\n')[0];
    } catch (e) {
      context.summary = `Changed ${files.length} files`;
    }
  } else {
    context.summary = `${trigger}: Changed ${files.length} files`;
  }

  // Detect if this looks like a fix/correction
  const lowerSummary = context.summary.toLowerCase();
  if (lowerSummary.includes('fix') || lowerSummary.includes('bug') || lowerSummary.includes('error')) {
    context.type = 'correction';
  } else if (lowerSummary.includes('refactor') || lowerSummary.includes('improve')) {
    context.type = 'pattern';
  }

  return context;
}

// ============================================================
// Knowledge Updates
// ============================================================

function ensureKnowledgeDir(skillPath) {
  const knowledgeDir = path.join(skillPath, 'knowledge');
  if (!fs.existsSync(knowledgeDir)) {
    fs.mkdirSync(knowledgeDir, { recursive: true });

    // Copy templates
    const templateDir = path.join(SKILLS_DIR, '_template', 'knowledge');
    if (fs.existsSync(templateDir)) {
      for (const file of ['learnings.md', 'patterns.md', 'anti-patterns.md']) {
        const src = path.join(templateDir, file);
        const dest = path.join(knowledgeDir, file);
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    }
  }
  return knowledgeDir;
}

function appendLearning(skillPath, context) {
  const knowledgeDir = ensureKnowledgeDir(skillPath);
  const learningsPath = path.join(knowledgeDir, 'learnings.md');

  const date = context.timestamp.split('T')[0];
  const entry = `
### ${date} - ${context.summary}

**Context**: ${context.trigger} trigger
**Trigger**: ${context.trigger}
**Type**: ${context.type}
**Files**: ${context.files.slice(0, 5).join(', ')}${context.files.length > 5 ? ` (+${context.files.length - 5} more)` : ''}

---
`;

  if (fs.existsSync(learningsPath)) {
    let content = fs.readFileSync(learningsPath, 'utf-8');

    // Find the "Recent Learnings" section and append after it
    const marker = '## Recent Learnings';
    const idx = content.indexOf(marker);
    if (idx !== -1) {
      const insertPoint = content.indexOf('\n', idx + marker.length) + 1;
      content = content.slice(0, insertPoint) + entry + content.slice(insertPoint);
    } else {
      content += '\n## Recent Learnings\n' + entry;
    }

    fs.writeFileSync(learningsPath, content);
    return true;
  }

  return false;
}

function updateSkillVersion(skillPath) {
  const skillMdPath = path.join(skillPath, 'skill.md');
  const legacyPath = path.join(skillPath, 'SKILL.md');
  const mdPath = fs.existsSync(skillMdPath) ? skillMdPath : legacyPath;

  if (!fs.existsSync(mdPath)) return;

  let content = fs.readFileSync(mdPath, 'utf-8');

  // Update lastUpdated
  const today = new Date().toISOString().split('T')[0];
  if (content.includes('lastUpdated:')) {
    content = content.replace(/lastUpdated:\s*[\d-]+/, `lastUpdated: ${today}`);
  }

  // Increment learningCount
  const countMatch = content.match(/learningCount:\s*(\d+)/);
  if (countMatch) {
    const newCount = parseInt(countMatch[1]) + 1;
    content = content.replace(/learningCount:\s*\d+/, `learningCount: ${newCount}`);
  }

  fs.writeFileSync(mdPath, content);
}

// ============================================================
// Feedback Patterns Integration
// ============================================================

/**
 * Extract file extensions/types from a list of files
 */
function getFileSignature(files) {
  const exts = files.map(f => {
    const ext = path.extname(f);
    // Group common patterns
    if (f.includes('.module.')) return '.module.*';
    if (f.includes('.controller.')) return '.controller.*';
    if (f.includes('.service.')) return '.service.*';
    if (f.includes('.entity.')) return '.entity.*';
    if (f.includes('.test.') || f.includes('.spec.')) return '.test.*';
    return ext || 'no-ext';
  });
  return [...new Set(exts)].sort().join(',');
}

/**
 * Log unmatched files to feedback-patterns.md with proper count tracking
 */
function logToFeedbackPatterns(context, unmatchedFiles) {
  const feedbackPath = path.join(STATE_DIR, 'feedback-patterns.md');

  if (!fs.existsSync(feedbackPath)) return;

  let content = fs.readFileSync(feedbackPath, 'utf-8');
  const date = context.timestamp.split('T')[0];

  // Get signature for deduplication
  const signature = getFileSignature(unmatchedFiles);
  const filesPreview = unmatchedFiles.slice(0, 3).join(', ');

  // Look for existing entry with same pattern (by #needs-skill tag and similar file types)
  const tableMarker = '| Date | Correction | Count |';
  const idx = content.indexOf(tableMarker);
  if (idx === -1) return;

  // Find all existing #needs-skill entries
  const lines = content.split('\n');
  let foundExisting = false;
  let existingLineIdx = -1;
  let existingCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('#needs-skill') && line.includes('Files changed with no matching skill')) {
      // Check if same file signature
      const lineSignature = getFileSignature(
        (line.match(/Files changed with no matching skill: ([^|]+)/)?.[1] || '')
          .split(', ')
          .map(f => f.trim())
          .filter(f => f)
      );

      if (lineSignature === signature || lineSignature === '' || signature === '') {
        // Found existing entry with same pattern - increment count
        const countMatch = line.match(/\|\s*(\d+)\s*\|/);
        if (countMatch) {
          existingCount = parseInt(countMatch[1]);
          existingLineIdx = i;
          foundExisting = true;
          break;
        }
      }
    }
  }

  if (foundExisting && existingLineIdx >= 0) {
    // Update existing entry with new count and date
    const newCount = existingCount + 1;
    const newEntry = `| ${date} | Files changed with no matching skill: ${filesPreview} | ${newCount} | - | #needs-skill |`;
    lines[existingLineIdx] = newEntry;
    content = lines.join('\n');
  } else {
    // Add new entry with count 1
    const entry = `| ${date} | Files changed with no matching skill: ${filesPreview} | 1 | - | #needs-skill |`;
    const headerEnd = content.indexOf('\n', content.indexOf('\n', idx) + 1) + 1;
    content = content.slice(0, headerEnd) + entry + '\n' + content.slice(headerEnd);
  }

  fs.writeFileSync(feedbackPath, content);
}

// ============================================================
// Main CLI
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    trigger: 'manual',
    skill: null,
    dryRun: false,
    verbose: false,
    help: false
  };

  for (const arg of args) {
    if (arg.startsWith('--trigger=')) {
      options.trigger = arg.split('=')[1];
    } else if (arg.startsWith('--skill=')) {
      options.skill = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Wogi Flow Skill Learning Engine

Usage:
  flow skill-learn [options]

Options:
  --trigger=TYPE    Trigger type: commit, task, compact, manual (default: manual)
  --skill=NAME      Target specific skill only
  --dry-run         Show what would be updated without making changes
  --verbose, -v     Show detailed output
  --help, -h        Show this help

Examples:
  flow skill-learn                      # Manual learning extraction
  flow skill-learn --trigger=commit     # Called from pre-commit hook
  flow skill-learn --skill=nestjs       # Update only nestjs skill
  flow skill-learn --dry-run            # Preview changes
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const config = loadConfig();

  if (!isLearningEnabled(config, options.trigger)) {
    if (options.verbose) {
      log('dim', 'Skill learning disabled for this trigger');
    }
    process.exit(0);
  }

  log('cyan', `\n📚 Skill Learning (${options.trigger})\n`);

  // Get changed files
  const files = options.trigger === 'commit'
    ? getChangedFiles(true)
    : getChangedFiles(false);

  if (files.length === 0) {
    log('dim', 'No changed files to analyze');
    process.exit(0);
  }

  log('white', `Found ${files.length} changed files`);

  // Discover skills
  let skills = discoverSkills();

  if (options.skill) {
    skills = skills.filter(s => s.name === options.skill);
    if (skills.length === 0) {
      log('yellow', `Skill '${options.skill}' not found`);
      process.exit(1);
    }
  }

  log('dim', `Checking against ${skills.length} skills`);

  // Match files to skills
  const { matches, unmatched } = matchFilesToSkills(files, skills);

  // Extract learning context
  const context = extractLearningContext(files, options.trigger);

  // Update matched skills
  let updatedCount = 0;

  for (const [skillName, skillFiles] of matches) {
    const skill = skills.find(s => s.name === skillName);

    log('green', `\n  ✓ ${skillName}: ${skillFiles.length} files`);

    if (options.verbose) {
      for (const f of skillFiles.slice(0, 3)) {
        log('dim', `    - ${f}`);
      }
      if (skillFiles.length > 3) {
        log('dim', `    ... +${skillFiles.length - 3} more`);
      }
    }

    if (!options.dryRun) {
      const skillContext = { ...context, files: skillFiles };
      appendLearning(skill.path, skillContext);
      updateSkillVersion(skill.path);
      updatedCount++;
    }
  }

  // Handle unmatched files
  if (unmatched.length > 0) {
    log('yellow', `\n  ⚠ ${unmatched.length} files with no matching skill`);

    if (options.verbose) {
      for (const f of unmatched.slice(0, 5)) {
        log('dim', `    - ${f}`);
      }
    }

    if (!options.dryRun) {
      logToFeedbackPatterns(context, unmatched);
    }
  }

  // Summary
  console.log('');
  if (options.dryRun) {
    log('yellow', `Dry run: Would update ${matches.size} skill(s)`);
  } else {
    log('green', `✅ Updated ${updatedCount} skill(s)`);
  }
  console.log('');
}

main().catch(e => {
  log('red', `Error: ${e.message}`);
  process.exit(1);
});
