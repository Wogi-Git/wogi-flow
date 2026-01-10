#!/usr/bin/env node

/**
 * Wogi Flow - Claude Code Adapter
 *
 * Transforms core hook results to Claude Code's hook format.
 * Handles SessionStart, PreToolUse, PostToolUse, Stop, SessionEnd.
 */

const path = require('path');
const fs = require('fs');
const { BaseAdapter } = require('./base-adapter');

// Import from parent scripts directory
const { PATHS } = require('../../flow-utils');

/**
 * Claude Code Hook Events
 */
const CLAUDE_CODE_EVENTS = [
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SubagentStop',
  'SessionEnd',
  'Notification',
  'UserPromptSubmit'
];

/**
 * Claude Code Adapter
 */
class ClaudeCodeAdapter extends BaseAdapter {
  constructor() {
    super('claude-code');
  }

  /**
   * Get Claude Code's settings path
   */
  getConfigPath() {
    return path.join(PATHS.claude, 'settings.json');
  }

  /**
   * Get local settings path (not committed)
   */
  getLocalConfigPath() {
    return path.join(PATHS.claude, 'settings.local.json');
  }

  /**
   * Get supported events
   */
  getSupportedEvents() {
    return CLAUDE_CODE_EVENTS;
  }

  /**
   * Check if Claude Code is likely available
   */
  isAvailable() {
    // Check if .claude directory exists
    return fs.existsSync(PATHS.claude);
  }

  /**
   * Parse Claude Code hook input
   */
  parseInput(input) {
    return {
      sessionId: input.session_id,
      transcriptPath: input.transcript_path,
      cwd: input.cwd,
      permissionMode: input.permission_mode,
      hookEvent: input.hook_event_name,
      toolName: input.tool_name,
      toolInput: input.tool_input,
      toolUseId: input.tool_use_id,
      toolResponse: input.tool_response,
      prompt: input.prompt,
      source: input.source,
      reason: input.reason
    };
  }

  /**
   * Transform core result to Claude Code format
   */
  transformResult(event, coreResult) {
    switch (event) {
      case 'SessionStart':
        return this.transformSessionStart(coreResult);
      case 'PreToolUse':
        return this.transformPreToolUse(coreResult);
      case 'PostToolUse':
        return this.transformPostToolUse(coreResult);
      case 'Stop':
      case 'SubagentStop':
        return this.transformStop(coreResult);
      case 'SessionEnd':
        return this.transformSessionEnd(coreResult);
      default:
        return { continue: true };
    }
  }

  /**
   * Transform SessionStart result
   */
  transformSessionStart(coreResult) {
    if (!coreResult.enabled || !coreResult.context) {
      return { continue: true };
    }

    // Format context for injection
    const { formatContextForInjection } = require('../core/session-context');
    const contextText = formatContextForInjection(coreResult);

    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: contextText
      }
    };
  }

  /**
   * Transform PreToolUse result (task gating, component check)
   */
  transformPreToolUse(coreResult) {
    // Blocked - deny permission
    if (coreResult.blocked) {
      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: coreResult.message || 'Action blocked by Wogi Flow'
        }
      };
    }

    // Warning - allow but show message
    if (coreResult.warning && coreResult.message) {
      return {
        continue: true,
        systemMessage: coreResult.message,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow'
        }
      };
    }

    // Allowed
    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow'
      }
    };
  }

  /**
   * Transform PostToolUse result (validation)
   */
  transformPostToolUse(coreResult) {
    // If validation was skipped or passed
    if (coreResult.skipped || coreResult.passed) {
      const message = coreResult.summary || (coreResult.passed ? 'Validation passed' : null);
      return {
        continue: true,
        ...(message && { systemMessage: message })
      };
    }

    // Validation failed
    return {
      continue: true,
      systemMessage: coreResult.summary || 'Validation failed',
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        decision: coreResult.blocked ? 'block' : undefined,
        reason: coreResult.message
      }
    };
  }

  /**
   * Transform Stop result (loop enforcement + task queue continuation)
   */
  transformStop(coreResult) {
    // Can exit
    if (coreResult.canExit) {
      return {
        continue: false, // Allow stop
        ...(coreResult.message && { systemMessage: coreResult.message })
      };
    }

    // Continue to next task in queue (not blocked, just continue)
    if (coreResult.continueToNext) {
      const nextTaskMsg = `
✓ Task complete!

**Continuing to next task in queue:** ${coreResult.nextTaskId}
(${coreResult.remaining} task(s) remaining)

Run: /wogi-start ${coreResult.nextTaskId}`;

      return {
        continue: true, // Force continue to next task
        systemMessage: nextTaskMsg,
        hookSpecificOutput: {
          hookEventName: 'Stop',
          decision: 'continue_queue',
          nextTaskId: coreResult.nextTaskId,
          remaining: coreResult.remaining
        }
      };
    }

    // Prompt before continuing to next task (pauseBetweenTasks: true)
    if (coreResult.shouldPrompt) {
      return {
        continue: true,
        systemMessage: coreResult.message,
        hookSpecificOutput: {
          hookEventName: 'Stop',
          decision: 'prompt_continue',
          nextTaskId: coreResult.nextTaskId
        }
      };
    }

    // Block exit - criteria not complete
    return {
      continue: true, // Force continue
      stopReason: coreResult.message || 'Acceptance criteria not complete',
      hookSpecificOutput: {
        hookEventName: 'Stop',
        decision: 'block',
        reason: coreResult.message
      }
    };
  }

  /**
   * Transform SessionEnd result (auto-logging)
   */
  transformSessionEnd(coreResult) {
    // SessionEnd doesn't block, just provides info
    return {
      continue: true,
      ...(coreResult.warning && { systemMessage: coreResult.warning }),
      ...(coreResult.logged && { systemMessage: `Logged as ${coreResult.requestId}` })
    };
  }

  /**
   * Generate Claude Code hook configuration
   */
  generateConfig(rules, projectRoot) {
    const scriptsDir = path.join(projectRoot, 'scripts', 'hooks', 'entry', 'claude-code');
    const hooks = {};

    // SessionStart hook
    if (rules.sessionContext?.enabled !== false) {
      hooks.SessionStart = [{
        hooks: [{
          type: 'command',
          command: `node "${path.join(scriptsDir, 'session-start.js')}"`,
          timeout: 10
        }]
      }];
    }

    // PreToolUse hooks for Edit/Write
    const preToolUseMatchers = [];

    if (rules.taskGating?.enabled !== false) {
      preToolUseMatchers.push({
        matcher: 'Edit|Write',
        hooks: [{
          type: 'command',
          command: `node "${path.join(scriptsDir, 'pre-tool-use.js')}"`,
          timeout: 5
        }]
      });
    }

    if (preToolUseMatchers.length > 0) {
      hooks.PreToolUse = preToolUseMatchers;
    }

    // PostToolUse hooks for validation
    if (rules.validation?.enabled !== false) {
      hooks.PostToolUse = [{
        matcher: 'Edit|Write',
        hooks: [{
          type: 'command',
          command: `node "${path.join(scriptsDir, 'post-tool-use.js')}"`,
          timeout: 60
        }]
      }];
    }

    // Stop hook for loop enforcement
    if (rules.loopEnforcement?.enabled !== false) {
      hooks.Stop = [{
        hooks: [{
          type: 'command',
          command: `node "${path.join(scriptsDir, 'stop.js')}"`,
          timeout: 5
        }]
      }];
    }

    // SessionEnd hook for auto-logging
    if (rules.autoLogging?.enabled !== false) {
      hooks.SessionEnd = [{
        hooks: [{
          type: 'command',
          command: `node "${path.join(scriptsDir, 'session-end.js')}"`,
          timeout: 10
        }]
      }];
    }

    return { hooks };
  }

  /**
   * Get install instructions
   */
  getInstallInstructions() {
    return `Claude Code hooks will be installed to ${this.getLocalConfigPath()}

To use:
1. Run: ./scripts/flow hooks setup
2. Hooks are automatically loaded by Claude Code

To remove:
- Run: ./scripts/flow hooks remove`;
  }
}

// Export singleton instance
const claudeCodeAdapter = new ClaudeCodeAdapter();

module.exports = {
  ClaudeCodeAdapter,
  claudeCodeAdapter,
  CLAUDE_CODE_EVENTS
};
