#!/usr/bin/env node

/**
 * Wogi Flow - Skill Auto-Creator
 *
 * Automatically detects frameworks in the project and offers to create
 * skills with knowledge from official documentation.
 *
 * Features:
 * - Scans project for framework indicators (package.json, file patterns)
 * - Fetches official documentation summaries
 * - Generates skill structure with patterns/anti-patterns
 * - Integrates with existing skill system
 */

const fs = require('fs');
const path = require('path');
const { getConfig, getProjectRoot } = require('./flow-utils');

/**
 * Detect frameworks in the project
 */
function detectFrameworks() {
  const projectRoot = getProjectRoot();
  const config = getConfig();
  const skillLearning = config.skillLearning || {};
  const patterns = skillLearning.frameworkDetectionPatterns || {};

  const detected = [];

  // Check package.json for dependencies
  const packageJsonPath = path.join(projectRoot, 'package.json');
  let packageDeps = {};

  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies
      };
    } catch {
      // Ignore parse errors
    }
  }

  // Check requirements.txt for Python
  const requirementsPath = path.join(projectRoot, 'requirements.txt');
  let pythonDeps = [];

  if (fs.existsSync(requirementsPath)) {
    try {
      pythonDeps = fs.readFileSync(requirementsPath, 'utf-8')
        .split('\n')
        .map(line => line.split('==')[0].split('>=')[0].trim().toLowerCase())
        .filter(Boolean);
    } catch {
      // Ignore
    }
  }

  // Scan for file patterns
  const srcDirs = ['src', 'app', 'lib', 'components', '.'];
  const foundFiles = {};

  for (const dir of srcDirs) {
    const fullDir = path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir) || !fs.statSync(fullDir).isDirectory()) continue;

    try {
      const files = scanDirectory(fullDir, 3); // Scan 3 levels deep
      for (const file of files) {
        const ext = path.extname(file);
        const basename = path.basename(file);
        if (!foundFiles[ext]) foundFiles[ext] = [];
        foundFiles[ext].push(basename);
      }
    } catch {
      // Ignore scan errors
    }
  }

  // Check each framework
  for (const [framework, framePatterns] of Object.entries(patterns)) {
    const reasons = [];

    for (const pattern of framePatterns) {
      // Check if pattern is a package name
      if (pattern.startsWith('@') || !pattern.includes('*')) {
        if (packageDeps[pattern]) {
          reasons.push(`package: ${pattern}`);
        }
        if (pythonDeps.includes(pattern.toLowerCase())) {
          reasons.push(`python-package: ${pattern}`);
        }
      }

      // Check file patterns
      if (pattern.includes('*')) {
        const ext = path.extname(pattern);
        const prefix = path.basename(pattern).replace('*', '');

        if (foundFiles[ext]) {
          const matches = foundFiles[ext].filter(f =>
            prefix ? f.includes(prefix.replace('.', '')) : true
          );
          if (matches.length > 0) {
            reasons.push(`files: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`);
          }
        }
      }
    }

    if (reasons.length > 0) {
      detected.push({
        framework,
        confidence: Math.min(reasons.length / 2, 1), // 0-1 scale
        reasons,
        docsUrl: (skillLearning.officialDocsUrls || {})[framework] || null
      });
    }
  }

  // Sort by confidence
  detected.sort((a, b) => b.confidence - a.confidence);

  return detected;
}

/**
 * Scan directory recursively
 */
function scanDirectory(dir, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];

  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip common non-source directories
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', '__pycache__', '.next'].includes(entry.name)) {
          continue;
        }
        files.push(...scanDirectory(path.join(dir, entry.name), maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        files.push(path.join(dir, entry.name));
      }
    }
  } catch {
    // Ignore permission errors
  }

  return files;
}

/**
 * Check if skill already exists
 */
function skillExists(framework) {
  const projectRoot = getProjectRoot();
  const skillPath = path.join(projectRoot, 'skills', framework);
  return fs.existsSync(skillPath);
}

/**
 * Get installed skills
 */
function getInstalledSkills() {
  const config = getConfig();
  return config.skills?.installed || [];
}

/**
 * Generate skill structure for a framework
 */
function generateSkillStructure(framework, docsUrl) {
  const projectRoot = getProjectRoot();
  const skillPath = path.join(projectRoot, 'skills', framework);

  // Create directory structure
  const dirs = [
    skillPath,
    path.join(skillPath, 'knowledge'),
    path.join(skillPath, 'rules'),
    path.join(skillPath, 'commands'),
    path.join(skillPath, 'templates')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Generate skill.md
  const skillMd = `# ${framework} Skill

## Overview
Auto-generated skill for ${framework} framework.

## Official Documentation
${docsUrl || 'Not specified'}

## File Patterns
Load this skill when working with files matching:
${getFilePatterns(framework)}

## Quick Reference
- See \`knowledge/patterns.md\` for common patterns
- See \`knowledge/anti-patterns.md\` for things to avoid
- See \`rules/conventions.md\` for coding conventions

## Commands
${generateCommandsList(framework)}

## Templates
See \`templates/\` for code templates.
`;

  fs.writeFileSync(path.join(skillPath, 'skill.md'), skillMd);

  // Generate knowledge files
  generateKnowledgeFiles(skillPath, framework);

  // Generate rules
  generateRulesFiles(skillPath, framework);

  return skillPath;
}

/**
 * Get file patterns for a framework
 */
function getFilePatterns(framework) {
  const patterns = {
    nestjs: '- `*.module.ts`\n- `*.controller.ts`\n- `*.service.ts`\n- `*.entity.ts`',
    react: '- `*.tsx`\n- `*.jsx`\n- `use*.ts` (hooks)',
    vue: '- `*.vue`\n- `composables/*.ts`',
    angular: '- `*.component.ts`\n- `*.service.ts`\n- `*.module.ts`',
    fastapi: '- `main.py`\n- `routers/*.py`\n- `models/*.py`',
    django: '- `views.py`\n- `models.py`\n- `urls.py`',
    express: '- `routes/*.js`\n- `middleware/*.js`\n- `controllers/*.js`'
  };

  return patterns[framework] || '- TBD based on project analysis';
}

/**
 * Generate commands list
 */
function generateCommandsList(framework) {
  const commands = {
    nestjs: `- \`/${framework}-scaffold [name]\` - Create module with controller/service\n- \`/${framework}-entity [name]\` - Create TypeORM entity`,
    react: `- \`/${framework}-component [name]\` - Create component\n- \`/${framework}-hook [name]\` - Create custom hook`,
    vue: `- \`/${framework}-component [name]\` - Create Vue component\n- \`/${framework}-composable [name]\` - Create composable`,
    fastapi: `- \`/${framework}-router [name]\` - Create router\n- \`/${framework}-model [name]\` - Create Pydantic model`,
    default: 'No commands defined yet. Add to `commands/` directory.'
  };

  return commands[framework] || commands.default;
}

/**
 * Generate knowledge files
 */
function generateKnowledgeFiles(skillPath, framework) {
  // patterns.md
  const patternsContent = `# ${framework} Patterns

## Common Patterns

### Pattern 1: [Name]
**When to use:** [Description]
**Example:**
\`\`\`typescript
// Code example
\`\`\`

---

*Add more patterns as you learn them. This file is automatically updated.*
`;

  fs.writeFileSync(path.join(skillPath, 'knowledge', 'patterns.md'), patternsContent);

  // anti-patterns.md
  const antiPatternsContent = `# ${framework} Anti-Patterns

## Things to Avoid

### Anti-Pattern 1: [Name]
**Why it's bad:** [Explanation]
**Instead, do:** [Better approach]

---

*Add more anti-patterns as you learn them. This file is automatically updated.*
`;

  fs.writeFileSync(path.join(skillPath, 'knowledge', 'anti-patterns.md'), antiPatternsContent);

  // learnings.md
  const learningsContent = `# ${framework} Learnings

## Session Learnings

*This file is automatically updated when the skill learning system detects relevant corrections or patterns.*

---

| Date | Learning | Source |
|------|----------|--------|
`;

  fs.writeFileSync(path.join(skillPath, 'knowledge', 'learnings.md'), learningsContent);
}

/**
 * Generate rules files
 */
function generateRulesFiles(skillPath, framework) {
  const conventions = {
    nestjs: `# NestJS Conventions

## File Naming
- Modules: \`[name].module.ts\`
- Controllers: \`[name].controller.ts\`
- Services: \`[name].service.ts\`
- Entities: \`[name].entity.ts\`

## Structure
- One module per feature/domain
- Controllers handle HTTP, services handle logic
- Use DTOs for request/response validation

## Dependency Injection
- Always inject via constructor
- Use interfaces for loose coupling
`,
    react: `# React Conventions

## File Naming
- Components: PascalCase \`ComponentName.tsx\`
- Hooks: camelCase with \`use\` prefix \`useHookName.ts\`

## Component Structure
- Functional components only
- Props interface above component
- Hooks at top of component

## State Management
- Local state for component-specific data
- Context for shared state
- Avoid prop drilling > 2 levels
`,
    default: `# ${framework} Conventions

## File Naming
TBD based on project conventions.

## Structure
TBD based on project structure.

## Best Practices
TBD based on official documentation.
`
  };

  const content = conventions[framework] || conventions.default;
  fs.writeFileSync(path.join(skillPath, 'rules', 'conventions.md'), content);
}

/**
 * Register skill in config.json
 */
function registerSkill(framework) {
  const projectRoot = getProjectRoot();
  const configPath = path.join(projectRoot, '.workflow', 'config.json');

  const config = getConfig();

  if (!config.skills) {
    config.skills = { installed: [] };
  }

  if (!config.skills.installed.includes(framework)) {
    config.skills.installed.push(framework);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Generate detection report
 */
function generateDetectionReport(detected) {
  const lines = [
    '',
    '╔════════════════════════════════════════════════════════╗',
    '║           🔍 FRAMEWORK DETECTION REPORT                ║',
    '╠════════════════════════════════════════════════════════╣'
  ];

  if (detected.length === 0) {
    lines.push('║  No frameworks detected in this project.'.padEnd(57) + '║');
    lines.push('╚════════════════════════════════════════════════════════╝');
    return lines.join('\n');
  }

  const installed = getInstalledSkills();

  for (const fw of detected) {
    const status = installed.includes(fw.framework) ? '✅' :
                   skillExists(fw.framework) ? '📦' : '❌';
    const confidence = Math.round(fw.confidence * 100);

    lines.push(`║  ${status} ${fw.framework.padEnd(20)} Confidence: ${confidence}%`.padEnd(57) + '║');

    for (const reason of fw.reasons.slice(0, 2)) {
      lines.push(`║     └─ ${reason}`.padEnd(57) + '║');
    }
  }

  lines.push('╠════════════════════════════════════════════════════════╣');
  lines.push('║  Legend: ✅ installed  📦 exists  ❌ not created'.padEnd(57) + '║');
  lines.push('╚════════════════════════════════════════════════════════╝');

  // Add suggestions
  const needsCreation = detected.filter(fw =>
    !installed.includes(fw.framework) && !skillExists(fw.framework)
  );

  if (needsCreation.length > 0) {
    lines.push('');
    lines.push('💡 Suggested skills to create:');
    for (const fw of needsCreation) {
      lines.push(`   ./scripts/flow skill-create ${fw.framework}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a skill interactively
 */
function createSkill(framework, options = {}) {
  const { docsUrl = null, autoRegister = true } = options;

  // Check if already exists
  if (skillExists(framework)) {
    return {
      success: false,
      message: `Skill '${framework}' already exists`,
      path: null
    };
  }

  // Get docs URL from config if not provided
  const config = getConfig();
  const finalDocsUrl = docsUrl ||
    (config.skillLearning?.officialDocsUrls || {})[framework] ||
    null;

  // Generate skill structure
  const skillPath = generateSkillStructure(framework, finalDocsUrl);

  // Register in config
  if (autoRegister) {
    registerSkill(framework);
  }

  return {
    success: true,
    message: `Skill '${framework}' created successfully`,
    path: skillPath,
    docsUrl: finalDocsUrl
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  detectFrameworks,
  skillExists,
  getInstalledSkills,
  generateSkillStructure,
  registerSkill,
  generateDetectionReport,
  createSkill
};

// ============================================================
// CLI
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'detect': {
      const detected = detectFrameworks();
      console.log(generateDetectionReport(detected));
      break;
    }

    case 'create': {
      const framework = args[1];
      if (!framework) {
        console.error('Usage: node flow-skill-creator.js create <framework>');
        process.exit(1);
      }

      const result = createSkill(framework);
      if (result.success) {
        console.log(`\n✅ ${result.message}`);
        console.log(`   Path: ${result.path}`);
        if (result.docsUrl) {
          console.log(`   Docs: ${result.docsUrl}`);
        }
        console.log('\nNext steps:');
        console.log('1. Review generated files in skills/' + framework);
        console.log('2. Add patterns from official documentation');
        console.log('3. Add project-specific conventions');
      } else {
        console.error(`\n❌ ${result.message}`);
        process.exit(1);
      }
      break;
    }

    case 'list': {
      const installed = getInstalledSkills();
      console.log('\n📚 Installed Skills\n');
      if (installed.length === 0) {
        console.log('No skills installed.');
      } else {
        installed.forEach(s => console.log(`  • ${s}`));
      }
      break;
    }

    default:
      console.log(`
Wogi Flow - Skill Auto-Creator

Usage:
  node flow-skill-creator.js <command> [args]

Commands:
  detect              Scan project and detect frameworks
  create <framework>  Create skill for a framework
  list                List installed skills

Examples:
  node flow-skill-creator.js detect
  node flow-skill-creator.js create nestjs
  node flow-skill-creator.js create react

Configuration (config.json):
  skillLearning.autoDetectFrameworks: true
  skillLearning.frameworkDetectionPatterns: { ... }
  skillLearning.officialDocsUrls: { ... }
`);
  }
}
