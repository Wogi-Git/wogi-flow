#!/usr/bin/env node

/**
 * Wogi Flow - Claude Code PreToolUse Hook
 *
 * Called before Edit/Write tool execution.
 * Enforces task gating and component reuse checking.
 */

const { checkTaskGate } = require('../../core/task-gate');
const { checkComponentReuse } = require('../../core/component-check');
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
    const filePath = toolInput.file_path;

    let coreResult = { allowed: true, blocked: false };

    // Task gating check (for Edit and Write)
    if (toolName === 'Edit' || toolName === 'Write') {
      coreResult = checkTaskGate({
        filePath,
        operation: toolName.toLowerCase()
      });

      // If blocked by task gating, return early
      if (coreResult.blocked) {
        const output = claudeCodeAdapter.transformResult('PreToolUse', coreResult);
        console.log(JSON.stringify(output));
        process.exit(0);
        return;
      }
    }

    // Component reuse check (for Write only)
    if (toolName === 'Write' && filePath) {
      const componentResult = checkComponentReuse({
        filePath,
        content: toolInput.content
      });

      // Merge results - component check can add warning or block
      if (componentResult.blocked || componentResult.warning) {
        coreResult = {
          ...coreResult,
          ...componentResult,
          // Preserve task gating allowance unless component check blocks
          allowed: !componentResult.blocked,
          blocked: componentResult.blocked
        };
      }
    }

    // Transform to Claude Code format
    const output = claudeCodeAdapter.transformResult('PreToolUse', coreResult);

    // Output JSON
    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    // Non-blocking error - allow operation to continue
    console.error(`[Wogi Flow Hook Error] ${err.message}`);
    // Exit 0 with allow to not block on hook errors (graceful degradation)
    console.log(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow'
      }
    }));
    process.exit(0);
  }
}

// Handle stdin properly
process.stdin.setEncoding('utf8');
main();
