# Google Gemini Flash Adapter

Model-specific guidance for Gemini Flash (1.5/2.0) when used as a hybrid mode executor.

## Strengths

- Extremely large context window (1M+ tokens)
- Fast response times (optimized for speed)
- Good at code generation
- Strong multi-modal capabilities
- Cost-effective for high-volume usage
- Good at following structured prompts
- Handles long code files well

## Weaknesses

- May produce verbose output
- Sometimes adds formatting when not requested
- Can be inconsistent with code style
- May include markdown formatting unexpectedly
- Less nuanced than Claude/GPT for complex tasks

## Prompt Adjustments

Guidance to include when using this model:

- Be explicit about output format requirements
- Specify "Do not include markdown formatting" if needed
- Include examples of expected output style
- Use clear section headers in prompts
- State character/style preferences explicitly
- For code, specify "raw code only, no explanations"

## Anti-Patterns to Avoid

Things this model tends to do wrong:

- Adding ** bold ** markdown in code comments
- Including preamble text before code
- Using backtick code fences when not requested
- Inconsistent indentation style
- Over-explaining simple code
- Adding TODO comments without being asked

## Known Issues

Documented bugs or limitations:

- API format differs from OpenAI-compatible endpoints
- Requires API key in URL query parameter
- Large context window can lead to slower responses with huge inputs
- Flash models prioritize speed over depth - complex reasoning may suffer
- Safety filters may block some legitimate coding tasks

## Learnings

Auto-learned patterns from usage. New entries are added automatically when repeated mistakes are detected.

<!-- New learnings will be appended below this line -->
