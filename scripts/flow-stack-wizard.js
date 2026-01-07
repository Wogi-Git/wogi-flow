#!/usr/bin/env node

/**
 * Tech Stack Wizard for Wogi Flow
 * Interactive questionnaire to configure project tech stack
 * and generate skills via Context7 documentation fetching
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// ============================================
// OPTION DEFINITIONS
// ============================================

const PROJECT_TYPES = [
  { key: '1', value: 'web', label: 'Web Application' },
  { key: '2', value: 'mobile', label: 'Mobile App (React Native / Flutter / Native)' },
  { key: '3', value: 'desktop', label: 'Desktop App (Electron / Tauri)' },
  { key: '4', value: 'backend', label: 'Backend API / Microservice' },
  { key: '5', value: 'fullstack', label: 'Full-Stack (Frontend + Backend)' },
  { key: '6', value: 'cli', label: 'CLI Tool' },
  { key: '7', value: 'library', label: 'Library / Package' },
  { key: '8', value: 'other', label: 'Other' }
];

const FOCUS_AREAS = [
  { key: '1', value: 'frontend', label: 'Frontend only' },
  { key: '2', value: 'backend', label: 'Backend only' },
  { key: '3', value: 'both', label: 'Full-stack (both)' }
];

const FRONTEND_FRAMEWORKS = [
  { key: '1', value: 'react', label: 'React', context7: '/facebook/react', group: 'React Ecosystem' },
  { key: '2', value: 'nextjs', label: 'Next.js', context7: '/vercel/next.js', group: 'React Ecosystem' },
  { key: '3', value: 'remix', label: 'Remix', context7: '/remix-run/remix', group: 'React Ecosystem' },
  { key: '4', value: 'gatsby', label: 'Gatsby', context7: '/gatsbyjs/gatsby', group: 'React Ecosystem' },
  { key: '5', value: 'vue', label: 'Vue 3', context7: '/vuejs/vue', group: 'Vue Ecosystem' },
  { key: '6', value: 'nuxt', label: 'Nuxt 3', context7: '/nuxt/nuxt', group: 'Vue Ecosystem' },
  { key: '7', value: 'svelte', label: 'Svelte / SvelteKit', context7: '/sveltejs/svelte', group: 'Other Frameworks' },
  { key: '8', value: 'angular', label: 'Angular', context7: '/angular/angular', group: 'Other Frameworks' },
  { key: '9', value: 'solid', label: 'Solid.js', context7: '/solidjs/solid', group: 'Other Frameworks' },
  { key: '10', value: 'qwik', label: 'Qwik', context7: '/qwikdev/qwik', group: 'Other Frameworks' },
  { key: '11', value: 'astro', label: 'Astro', context7: '/withastro/astro', group: 'Other Frameworks' },
  { key: '12', value: 'react-native', label: 'React Native', context7: '/facebook/react-native', group: 'Mobile' },
  { key: '13', value: 'expo', label: 'Expo', context7: '/expo/expo', group: 'Mobile' },
  { key: '14', value: 'flutter', label: 'Flutter', context7: '/flutter/flutter', group: 'Mobile' },
  { key: '0', value: 'none', label: 'None / Other', context7: null, group: null }
];

const BACKEND_FRAMEWORKS = [
  { key: '1', value: 'express', label: 'Express', context7: '/expressjs/express', group: 'Node.js' },
  { key: '2', value: 'nestjs', label: 'NestJS', context7: '/nestjs/nest', group: 'Node.js' },
  { key: '3', value: 'fastify', label: 'Fastify', context7: '/fastify/fastify', group: 'Node.js' },
  { key: '4', value: 'hono', label: 'Hono', context7: '/honojs/hono', group: 'Node.js' },
  { key: '5', value: 'trpc', label: 'tRPC', context7: '/trpc/trpc', group: 'Node.js' },
  { key: '6', value: 'fastapi', label: 'FastAPI', context7: '/tiangolo/fastapi', group: 'Python' },
  { key: '7', value: 'django', label: 'Django', context7: '/django/django', group: 'Python' },
  { key: '8', value: 'flask', label: 'Flask', context7: '/pallets/flask', group: 'Python' },
  { key: '9', value: 'go', label: 'Go (Gin/Echo/Fiber)', context7: '/gin-gonic/gin', group: 'Other' },
  { key: '10', value: 'rust', label: 'Rust (Actix/Axum)', context7: '/tokio-rs/axum', group: 'Other' },
  { key: '11', value: 'spring', label: 'Java (Spring Boot)', context7: '/spring-projects/spring-boot', group: 'Other' },
  { key: '12', value: 'dotnet', label: '.NET (ASP.NET Core)', context7: '/dotnet/aspnetcore', group: 'Other' },
  { key: '13', value: 'rails', label: 'Ruby on Rails', context7: '/rails/rails', group: 'Other' },
  { key: '14', value: 'phoenix', label: 'Elixir (Phoenix)', context7: '/phoenixframework/phoenix', group: 'Other' },
  { key: '0', value: 'none', label: 'None / Other', context7: null, group: null }
];

const STATE_MANAGEMENT = [
  { key: '1', value: 'context', label: 'React Context + useReducer', context7: null, group: 'React' },
  { key: '2', value: 'redux', label: 'Redux Toolkit', context7: '/reduxjs/redux-toolkit', group: 'React' },
  { key: '3', value: 'zustand', label: 'Zustand', context7: '/pmndrs/zustand', group: 'React' },
  { key: '4', value: 'jotai', label: 'Jotai', context7: '/pmndrs/jotai', group: 'React' },
  { key: '5', value: 'recoil', label: 'Recoil', context7: '/facebookexperimental/recoil', group: 'React' },
  { key: '6', value: 'mobx', label: 'MobX', context7: '/mobxjs/mobx', group: 'React' },
  { key: '7', value: 'tanstack-query', label: 'TanStack Query (server state)', context7: '/tanstack/query', group: 'React' },
  { key: '8', value: 'pinia', label: 'Pinia', context7: '/vuejs/pinia', group: 'Vue' },
  { key: '9', value: 'vuex', label: 'Vuex', context7: '/vuejs/vuex', group: 'Vue' },
  { key: '10', value: 'xstate', label: 'XState (state machines)', context7: '/statelyai/xstate', group: 'General' },
  { key: '11', value: 'none', label: 'None / Custom', context7: null, group: 'General' }
];

const STYLING_OPTIONS = [
  { key: '1', value: 'tailwind', label: 'Tailwind CSS', context7: '/tailwindlabs/tailwindcss' },
  { key: '2', value: 'css-modules', label: 'CSS Modules', context7: null },
  { key: '3', value: 'styled-components', label: 'Styled Components', context7: '/styled-components/styled-components' },
  { key: '4', value: 'emotion', label: 'Emotion', context7: '/emotion-js/emotion' },
  { key: '5', value: 'vanilla-extract', label: 'Vanilla Extract', context7: '/vanilla-extract-css/vanilla-extract' },
  { key: '6', value: 'sass', label: 'Sass/SCSS', context7: '/sass/sass' },
  { key: '7', value: 'css', label: 'Plain CSS', context7: null },
  { key: '8', value: 'shadcn', label: 'shadcn/ui + Tailwind', context7: '/shadcn-ui/ui' }
];

const DATABASE_OPTIONS = [
  { key: '1', value: 'postgresql', label: 'PostgreSQL', context7: '/postgres/postgres', group: 'SQL' },
  { key: '2', value: 'mysql', label: 'MySQL', context7: '/mysql/mysql-server', group: 'SQL' },
  { key: '3', value: 'sqlite', label: 'SQLite', context7: '/sqlite/sqlite', group: 'SQL' },
  { key: '4', value: 'mongodb', label: 'MongoDB', context7: '/mongodb/mongo', group: 'NoSQL' },
  { key: '5', value: 'redis', label: 'Redis', context7: '/redis/redis', group: 'NoSQL' },
  { key: '6', value: 'dynamodb', label: 'DynamoDB', context7: '/aws/aws-sdk', group: 'NoSQL' },
  { key: '7', value: 'prisma', label: 'Prisma', context7: '/prisma/prisma', group: 'ORM/ODM' },
  { key: '8', value: 'drizzle', label: 'Drizzle', context7: '/drizzle-team/drizzle-orm', group: 'ORM/ODM' },
  { key: '9', value: 'typeorm', label: 'TypeORM', context7: '/typeorm/typeorm', group: 'ORM/ODM' },
  { key: '10', value: 'mongoose', label: 'Mongoose', context7: '/automattic/mongoose', group: 'ORM/ODM' },
  { key: '11', value: 'sequelize', label: 'Sequelize', context7: '/sequelize/sequelize', group: 'ORM/ODM' },
  { key: '0', value: 'none', label: 'None', context7: null, group: null }
];

const TESTING_OPTIONS = [
  { key: '1', value: 'jest', label: 'Jest', context7: '/jestjs/jest' },
  { key: '2', value: 'vitest', label: 'Vitest', context7: '/vitest-dev/vitest' },
  { key: '3', value: 'playwright', label: 'Playwright', context7: '/microsoft/playwright' },
  { key: '4', value: 'cypress', label: 'Cypress', context7: '/cypress-io/cypress' },
  { key: '5', value: 'testing-library', label: 'Testing Library', context7: '/testing-library/react-testing-library' },
  { key: '6', value: 'pytest', label: 'Pytest', context7: '/pytest-dev/pytest' },
  { key: '0', value: 'none', label: 'None', context7: null }
];

const ADDITIONAL_TOOLS = [
  { key: '1', value: 'docker', label: 'Docker', context7: '/docker/docs' },
  { key: '2', value: 'kubernetes', label: 'Kubernetes', context7: '/kubernetes/kubernetes' },
  { key: '3', value: 'terraform', label: 'Terraform', context7: '/hashicorp/terraform' },
  { key: '4', value: 'github-actions', label: 'GitHub Actions', context7: '/actions/toolkit' },
  { key: '5', value: 'graphql', label: 'GraphQL', context7: '/graphql/graphql-js' },
  { key: '6', value: 'websockets', label: 'WebSockets', context7: '/websockets/ws' },
  { key: '7', value: 'auth', label: 'Auth (NextAuth/Clerk/Auth0)', context7: '/nextauthjs/next-auth' },
  { key: '8', value: 'payments', label: 'Payments (Stripe)', context7: '/stripe/stripe-node' }
];

// ============================================
// "CHOOSE BEST FOR ME" DEFAULTS
// ============================================

const BEST_DEFAULTS = {
  projectType: 'fullstack',
  focus: 'both',
  frontend: 'nextjs',
  stateManagement: 'tanstack-query',
  styling: 'shadcn',
  backend: 'nestjs',
  database: 'prisma',
  testing: 'vitest'
};

// ============================================
// WIZARD LOGIC
// ============================================

class StackWizard {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.selections = {};
  }

  async run() {
    console.log('\n' + '='.repeat(60));
    console.log('  Tech Stack Wizard');
    console.log('  Configure your project and generate coding patterns');
    console.log('='.repeat(60) + '\n');

    try {
      // Step 1: Project Type
      this.selections.projectType = await this.askSingleChoice(
        'What type of project is this?',
        PROJECT_TYPES
      );

      // Step 2: Focus Area (conditional)
      if (this.needsFocusQuestion()) {
        this.selections.focus = await this.askSingleChoice(
          "What's your focus?",
          FOCUS_AREAS
        );
      } else {
        this.selections.focus = this.inferFocus();
      }

      // Step 3: Frontend Framework (if applicable)
      if (this.needsFrontend()) {
        this.selections.frontend = await this.askGroupedChoice(
          'Frontend framework:',
          FRONTEND_FRAMEWORKS,
          true,
          'frontend'
        );

        // Step 5: State Management
        if (this.selections.frontend && this.selections.frontend !== 'none') {
          this.selections.stateManagement = await this.askGroupedChoice(
            'State management:',
            this.filterStateOptions(),
            true,
            'stateManagement'
          );
        }

        // Step 6: Styling
        if (this.selections.frontend && this.selections.frontend !== 'none') {
          this.selections.styling = await this.askSingleChoice(
            'Styling approach:',
            STYLING_OPTIONS,
            true,
            'styling'
          );
        }
      }

      // Step 4: Backend Framework (if applicable)
      if (this.needsBackend()) {
        this.selections.backend = await this.askGroupedChoice(
          'Backend framework:',
          BACKEND_FRAMEWORKS,
          true,
          'backend'
        );

        // Step 7: Database
        if (this.selections.backend && this.selections.backend !== 'none') {
          this.selections.database = await this.askGroupedChoice(
            'Database:',
            DATABASE_OPTIONS,
            true,
            'database'
          );
        }
      }

      // Step 8: Testing (optional)
      this.selections.testing = await this.askSingleChoice(
        'Testing framework:',
        TESTING_OPTIONS,
        true,
        'testing'
      );

      // Step 9: Additional Tools (multi-select)
      this.selections.additionalTools = await this.askMultiChoice(
        'Additional tools (comma-separated numbers or "none"):',
        ADDITIONAL_TOOLS
      );

      // Show summary
      this.showSummary();

      // Generate skills
      const proceed = await this.askConfirmation(
        '\nGenerate skills and fetch documentation? [Y/n] '
      );

      if (proceed) {
        await this.generateSkills();
      } else {
        console.log('\nSkipped skill generation. You can run this later with:');
        console.log('  ./scripts/flow setup-stack\n');
      }

    } finally {
      this.rl.close();
    }

    return this.selections;
  }

  // ----------------------------------------
  // Question helpers
  // ----------------------------------------

  needsFocusQuestion() {
    const type = this.selections.projectType;
    return ['web', 'fullstack', 'other'].includes(type);
  }

  inferFocus() {
    const type = this.selections.projectType;
    if (['backend', 'cli', 'library'].includes(type)) return 'backend';
    if (['mobile', 'desktop'].includes(type)) return 'frontend';
    return 'both';
  }

  needsFrontend() {
    const focus = this.selections.focus;
    return ['frontend', 'both'].includes(focus);
  }

  needsBackend() {
    const focus = this.selections.focus;
    return ['backend', 'both'].includes(focus);
  }

  filterStateOptions() {
    const frontend = this.selections.frontend;

    // Filter by relevant ecosystem
    if (['vue', 'nuxt'].includes(frontend)) {
      return STATE_MANAGEMENT.filter(opt =>
        opt.group === 'Vue' || opt.group === 'General'
      );
    }
    if (['react', 'nextjs', 'remix', 'gatsby', 'react-native', 'expo'].includes(frontend)) {
      return STATE_MANAGEMENT.filter(opt =>
        opt.group === 'React' || opt.group === 'General'
      );
    }
    // For other frameworks, show general options
    return STATE_MANAGEMENT.filter(opt => opt.group === 'General');
  }

  // ----------------------------------------
  // Input methods
  // ----------------------------------------

  askQuestion(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async askSingleChoice(question, options, allowBest = false, fieldName = null) {
    const MAX_RETRIES = 10;
    let retries = 0;

    console.log(`\n${question}`);

    // Print options
    for (const opt of options) {
      console.log(`  (${opt.key}) ${opt.label}`);
    }
    if (allowBest) {
      console.log(`  (?) Choose best for me`);
    }

    while (retries < MAX_RETRIES) {
      const answer = await this.askQuestion('\nYour choice: ');

      if (allowBest && answer === '?') {
        const field = fieldName || this.getCurrentField(options);
        const best = BEST_DEFAULTS[field];
        if (best) {
          const option = options.find(o => o.value === best);
          console.log(`  -> ${option ? option.label : best}`);
          return best;
        }
      }

      const option = options.find(o => o.key === answer);
      if (option) {
        return option.value;
      }

      retries++;
      const remaining = MAX_RETRIES - retries;
      if (remaining > 0) {
        console.log(`  Invalid choice. ${remaining} attempts remaining.`);
      }
    }

    // Fallback to first option after too many retries
    console.log('  Too many invalid attempts. Using default.');
    return options[0].value;
  }

  async askGroupedChoice(question, options, allowBest = false, fieldName = null) {
    const MAX_RETRIES = 10;
    let retries = 0;

    console.log(`\n${question}`);

    // Group options
    const groups = {};
    for (const opt of options) {
      const group = opt.group || 'Options';
      if (!groups[group]) groups[group] = [];
      groups[group].push(opt);
    }

    // Print grouped options
    for (const [groupName, groupOpts] of Object.entries(groups)) {
      if (groupName !== 'Options' && groupName !== null) {
        console.log(`  [${groupName}]`);
      }
      for (const opt of groupOpts) {
        console.log(`  (${opt.key}) ${opt.label}`);
      }
      console.log();
    }
    if (allowBest) {
      console.log(`  (?) Choose best for me`);
    }

    while (retries < MAX_RETRIES) {
      const answer = await this.askQuestion('Your choice: ');

      if (allowBest && answer === '?') {
        const field = fieldName || this.getCurrentField(options);
        const best = BEST_DEFAULTS[field];
        if (best) {
          const option = options.find(o => o.value === best);
          console.log(`  -> ${option ? option.label : best}`);
          return best;
        }
      }

      const option = options.find(o => o.key === answer);
      if (option) {
        return option.value;
      }

      retries++;
      const remaining = MAX_RETRIES - retries;
      if (remaining > 0) {
        console.log(`  Invalid choice. ${remaining} attempts remaining.`);
      }
    }

    // Fallback to first option after too many retries
    console.log('  Too many invalid attempts. Using default.');
    return options[0].value;
  }

  async askMultiChoice(question, options) {
    console.log(`\n${question}`);

    for (const opt of options) {
      console.log(`  (${opt.key}) ${opt.label}`);
    }

    const answer = await this.askQuestion('\nYour choices: ');

    if (answer.toLowerCase() === 'none' || answer === '') {
      return [];
    }

    const keys = answer.split(',').map(k => k.trim());
    const selected = [];

    for (const key of keys) {
      const option = options.find(o => o.key === key);
      if (option) {
        selected.push(option.value);
      }
    }

    return selected;
  }

  async askConfirmation(prompt) {
    const answer = await this.askQuestion(prompt);
    return answer.toLowerCase() !== 'n';
  }

  getCurrentField(options) {
    // Infer field name from options
    if (options === FRONTEND_FRAMEWORKS) return 'frontend';
    if (options === BACKEND_FRAMEWORKS) return 'backend';
    if (options === STATE_MANAGEMENT) return 'stateManagement';
    if (options === STYLING_OPTIONS) return 'styling';
    if (options === DATABASE_OPTIONS) return 'database';
    if (options === TESTING_OPTIONS) return 'testing';
    return null;
  }

  // ----------------------------------------
  // Summary and generation
  // ----------------------------------------

  showSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('  Your Tech Stack');
    console.log('='.repeat(60) + '\n');

    const display = (label, value, options) => {
      if (!value || value === 'none') return;
      const opt = options?.find(o => o.value === value);
      console.log(`  ${label}: ${opt ? opt.label : value}`);
    };

    display('Project Type', this.selections.projectType, PROJECT_TYPES);
    display('Focus', this.selections.focus, FOCUS_AREAS);
    display('Frontend', this.selections.frontend, FRONTEND_FRAMEWORKS);
    display('State Management', this.selections.stateManagement, STATE_MANAGEMENT);
    display('Styling', this.selections.styling, STYLING_OPTIONS);
    display('Backend', this.selections.backend, BACKEND_FRAMEWORKS);
    display('Database', this.selections.database, DATABASE_OPTIONS);
    display('Testing', this.selections.testing, TESTING_OPTIONS);

    if (this.selections.additionalTools?.length > 0) {
      const toolLabels = this.selections.additionalTools.map(t => {
        const opt = ADDITIONAL_TOOLS.find(o => o.value === t);
        return opt ? opt.label : t;
      });
      console.log(`  Additional: ${toolLabels.join(', ')}`);
    }

    console.log();
  }

  async generateSkills() {
    console.log('\nGenerating skills...');

    // Collect all technologies to fetch
    const technologies = this.collectTechnologies();

    if (technologies.length === 0) {
      console.log('No technologies selected that require skill generation.');
      return;
    }

    // Call the skill generator
    try {
      const generator = require('./flow-skill-generator');
      await generator.generateSkills(technologies, this.selections);
      console.log('\n✓ Skills generated successfully!\n');
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log('\nSkill generator not found. Creating placeholder...');
        this.saveSelectionsToFile();
      } else {
        console.error('\nError generating skills:', error.message);
        console.log('\nSaving selections for later processing...');
        this.saveSelectionsToFile();
      }
    }
  }

  collectTechnologies() {
    const techs = [];
    const allOptions = [
      ...FRONTEND_FRAMEWORKS,
      ...BACKEND_FRAMEWORKS,
      ...STATE_MANAGEMENT,
      ...STYLING_OPTIONS,
      ...DATABASE_OPTIONS,
      ...TESTING_OPTIONS,
      ...ADDITIONAL_TOOLS
    ];

    const values = [
      this.selections.frontend,
      this.selections.backend,
      this.selections.stateManagement,
      this.selections.styling,
      this.selections.database,
      this.selections.testing,
      ...(this.selections.additionalTools || [])
    ].filter(v => v && v !== 'none');

    for (const value of values) {
      const option = allOptions.find(o => o.value === value);
      if (option && option.context7) {
        techs.push({
          value: option.value,
          label: option.label,
          context7: option.context7
        });
      }
    }

    return techs;
  }

  saveSelectionsToFile() {
    const projectRoot = process.cwd();
    const selectionsPath = path.join(projectRoot, '.workflow', 'state', 'stack-selections.json');

    try {
      fs.mkdirSync(path.dirname(selectionsPath), { recursive: true });
      fs.writeFileSync(selectionsPath, JSON.stringify(this.selections, null, 2));
      console.log(`\nSelections saved to: ${selectionsPath}`);
      console.log('Run skill generation later with: ./scripts/flow setup-stack --generate');
    } catch (error) {
      console.error('Failed to save selections:', error.message);
    }
  }
}

// ============================================
// EXPORTS & CLI
// ============================================

module.exports = {
  StackWizard,
  PROJECT_TYPES,
  FOCUS_AREAS,
  FRONTEND_FRAMEWORKS,
  BACKEND_FRAMEWORKS,
  STATE_MANAGEMENT,
  STYLING_OPTIONS,
  DATABASE_OPTIONS,
  TESTING_OPTIONS,
  ADDITIONAL_TOOLS,
  BEST_DEFAULTS
};

// Run if called directly
if (require.main === module) {
  const wizard = new StackWizard();
  wizard.run()
    .then((selections) => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Wizard error:', error);
      process.exit(1);
    });
}
