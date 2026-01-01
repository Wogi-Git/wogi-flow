# LM Studio Default Adapter

Model-specific guidance for models running on LM Studio.

## Strengths

- Easy local deployment
- Good privacy (no data leaves machine)
- Configurable parameters (temperature, tokens)
- Wide model selection
- Good for experimentation
- Consistent local performance

## Weaknesses

- Model quality varies significantly
- May need per-model tuning
- Hardware dependent performance
- Limited context compared to cloud models
- May struggle with complex codebases

## Prompt Adjustments

Guidance to include when using this model:

- Keep prompts focused and specific
- Provide clear input/output examples
- Use simpler language (avoid jargon)
- Break complex tasks into steps
- Specify format requirements explicitly
- Include relevant context inline (don't assume knowledge)

## Anti-Patterns to Avoid

Things this model tends to do wrong:

- Generating incomplete code
- Not following coding conventions
- Using incorrect import paths
- Missing type annotations
- Inconsistent variable naming

## Known Issues

Documented bugs or limitations:

- Performance varies by model and hardware
- May timeout on large contexts
- Some models have tokenization issues
- Quantized models may have quality loss

## Learnings

Auto-learned patterns from usage. New entries are added automatically when repeated mistakes are detected.

<!-- New learnings will be appended below this line -->
