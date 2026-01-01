# Ollama Nemotron Adapter

Model-specific guidance for NVIDIA Nemotron models (nemotron-3-nano, etc.) running on Ollama.

## Strengths

- Excellent instruction following
- Good at structured outputs (JSON, code)
- Reliable for template-based generation
- Consistent formatting
- Fast inference on local hardware
- Good at following step-by-step plans

## Weaknesses

- Limited reasoning on complex problems
- May struggle with ambiguous requirements
- Less creative than larger models
- Context window limitations
- May need more explicit templates
- Can be literal (misses implied requirements)

## Prompt Adjustments

Guidance to include when using this model:

- Provide explicit templates for output format
- Break tasks into atomic steps
- Include examples of expected output
- Avoid ambiguous language
- Specify all constraints explicitly
- Use structured prompts with clear sections

## Anti-Patterns to Avoid

Things this model tends to do wrong:

- Hallucinating file paths that don't exist
- Using placeholder values instead of actual data
- Incomplete JSON (missing closing brackets)
- Not following import conventions
- Generating code that doesn't compile

## Known Issues

Documented bugs or limitations:

- May truncate long outputs
- Struggles with multi-file context
- Can repeat itself on complex tasks
- Limited understanding of project structure

## Learnings

Auto-learned patterns from usage. New entries are added automatically when repeated mistakes are detected.

<!-- New learnings will be appended below this line -->
