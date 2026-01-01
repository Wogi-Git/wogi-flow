# Claude Opus Adapter

Model-specific guidance for Claude Opus (claude-opus-4, claude-3-opus).

## Strengths

- Exceptional reasoning and complex problem solving
- Strong at multi-step tasks and long-context understanding
- Excellent code quality and architectural decisions
- Good at following nuanced instructions
- Strong at creative and novel solutions
- Best for planning and design tasks

## Weaknesses

- Can be overly thorough (verbose responses)
- Sometimes over-engineers simple solutions
- May add unnecessary abstractions
- Higher token cost for simple tasks
- Can be slow to respond on complex queries

## Prompt Adjustments

Guidance to include when using this model:

- Keep solutions simple unless complexity is warranted
- Avoid adding features not explicitly requested
- Prefer direct implementations over abstractions
- Focus on the minimal viable solution first

## Anti-Patterns to Avoid

Things this model tends to do wrong:

- Adding helper functions for one-time operations
- Creating abstractions before they're needed
- Over-commenting obvious code
- Adding error handling for impossible scenarios
- Verbose explanations when concise is better

## Known Issues

Documented bugs or limitations:

- May timeout on very long responses
- Occasional hallucination of API endpoints
- Sometimes suggests deprecated patterns

## Learnings

Auto-learned patterns from usage. New entries are added automatically when repeated mistakes are detected.

<!-- New learnings will be appended below this line -->
