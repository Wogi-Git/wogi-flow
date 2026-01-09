#!/usr/bin/env node

/**
 * Wogi Flow - Claude Code PostToolUse Hook
 *
 * Called after Edit/Write tool execution.
 * Runs validation (lint, typecheck) on modified files.
 */

const { runValidation } = require('../../core/validation');
const { claudeCodeAdapter } = require('../../adapters/claude-code');

async function main() {
  try {
    // Read input from stdin
    let inputData = '';
    for await (const chunk of process.stdin) {
      inputData += chunk;
    }

    const input = inputData ? JSON.parse(inputData) : {};
    const parsedInput = claudeCodeAdapter.parseInput(input);

    const toolName = parsedInput.toolName;
    const toolInput = parsedInput.toolInput || {};
    const toolResponse = parsedInput.toolResponse;
    const filePath = toolInput.file_path;

    // Only run validation for Edit/Write
    if (toolName !== 'Edit' && toolName !== 'Write') {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
      return;
    }

    // Skip if tool failed
    if (toolResponse && toolResponse.error) {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
      return;
    }

    // Run validation
    const coreResult = await runValidation({
      filePath,
      timeout: 30000
    });

    // Transform to Claude Code format
    const output = claudeCodeAdapter.transformResult('PostToolUse', coreResult);

    // Output JSON
    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    // Non-blocking error
    console.error(`[Wogi Flow Hook Error] ${err.message}`);
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

// Handle stdin properly
process.stdin.setEncoding('utf8');
main();
