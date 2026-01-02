# Anthropic Claude Haiku Adapter

Model-specific guidance for Claude 3 Haiku / Claude 3.5 Haiku when used as a hybrid mode executor.

## Strengths

- Exceptional instruction following
- Natural handling of code generation
- Strong understanding of context and intent
- Good at following project conventions
- Fast response times (optimized for speed)
- Handles nuanced requirements well
- Consistent output quality
- Large context window (200k tokens)

## Weaknesses

- May occasionally add helpful notes when asked for code only
- Sometimes includes alternatives or suggestions
- Can be cautious about edge cases
- Token costs higher than some competitors
- May refuse tasks it considers unclear

## Prompt Adjustments

Guidance to include when using this model:

- Claude naturally follows instructions well, minimal adjustments needed
- For code-only output, include "Reply with only the code"
- Explicitly state if you don't want suggestions or alternatives
- Haiku benefits from clear, structured prompts
- Include "Do not include explanatory text" if needed

## Anti-Patterns to Avoid

Things this model tends to do wrong:

- Occasionally prefixes code with "Here's the..." type introductions
- May include usage examples when not requested
- Sometimes adds type annotations that weren't in the original
- Can over-engineer simple solutions

## Known Issues

Documented bugs or limitations:

- Rate limits may apply for high-volume usage
- API requires anthropic-version header
- Large context window doesn't mean unlimited - still need to manage token budget
- Haiku is optimized for speed over depth - complex reasoning may benefit from Sonnet

## Learnings

Auto-learned patterns from usage. New entries are added automatically when repeated mistakes are detected.

<!-- New learnings will be appended below this line -->
