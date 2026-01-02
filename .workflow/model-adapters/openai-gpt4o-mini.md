# OpenAI GPT-4o-mini Adapter

Model-specific guidance for GPT-4o-mini when used as a hybrid mode executor.

## Strengths

- Excellent instruction following
- Good at structured outputs (JSON, code)
- Reliable formatting and consistency
- Strong understanding of code patterns
- Fast response times
- Good at following conventions
- Handles multi-step tasks well

## Weaknesses

- May add explanatory comments when not asked
- Sometimes wraps code in markdown even when instructed not to
- Can be verbose in responses
- May ask clarifying questions instead of making reasonable assumptions
- Token costs add up for large outputs
- Less creative than larger models

## Prompt Adjustments

Guidance to include when using this model:

- Explicitly state "Output ONLY the code, no explanations"
- Specify "Do not wrap code in markdown fences"
- Be specific about desired output format
- Provide examples of expected output
- State "Do not ask clarifying questions, make reasonable assumptions"
- Keep prompts focused and direct

## Anti-Patterns to Avoid

Things this model tends to do wrong:

- Adding "// Here's the code:" or similar preambles
- Including markdown code fences when not requested
- Adding trailing explanations after code
- Verbose variable naming when concise is preferred
- Over-commenting code

## Known Issues

Documented bugs or limitations:

- Context window is large (128k) but costs scale with usage
- May occasionally refuse tasks it considers ambiguous
- Rate limits may apply during high usage

## Learnings

Auto-learned patterns from usage. New entries are added automatically when repeated mistakes are detected.

<!-- New learnings will be appended below this line -->
