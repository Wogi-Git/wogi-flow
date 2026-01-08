# Voice Input

Voice-driven commands for hands-free development.

---

## Status

Voice input is available but requires configuration of a speech-to-text provider.

---

## Configuration

```json
{
  "voice": {
    "enabled": false,
    "provider": null,            // "openai" | "groq" | "local"
    "openaiApiKey": null,
    "groqApiKey": null,
    "localModelPath": "base.en",
    "defaultDuration": 30,       // Seconds to record
    "sampleRate": 16000,
    "channels": 1
  }
}
```

---

## Providers

### OpenAI Whisper

```json
{
  "voice": {
    "enabled": true,
    "provider": "openai",
    "openaiApiKey": "sk-..."
  }
}
```

Best for: Accuracy, multi-language support

### Groq

```json
{
  "voice": {
    "enabled": true,
    "provider": "groq",
    "groqApiKey": "gsk_..."
  }
}
```

Best for: Speed, cost efficiency

### Local (Whisper.cpp)

```json
{
  "voice": {
    "enabled": true,
    "provider": "local",
    "localModelPath": "base.en"
  }
}
```

Best for: Privacy, offline use

---

## Usage

### Start Voice Input

```bash
/wogi-voice
```

### Recording

```
🎤 Recording... (speak now)
[30 second max]
[Press Enter to stop early]

Processing...

Transcribed: "Add a logout button to the header"

Execute? [y/n]
```

### Direct Command

```bash
/wogi-voice "create a new component"
```

---

## Commands You Can Say

| Type | Example |
|------|---------|
| Task start | "Start task fifteen" |
| Create | "Create a button component" |
| Fix | "Fix the login bug" |
| Search | "Search for authentication code" |
| Status | "Show project status" |
| Navigate | "Open the user service file" |

---

## Voice Command Mapping

Voice commands are mapped to Wogi commands:

| Voice | Mapped To |
|-------|-----------|
| "start task X" | `/wogi-start TASK-X` |
| "show ready tasks" | `/wogi-ready` |
| "project status" | `/wogi-status` |
| "create story about X" | `/wogi-story "X"` |
| "run health check" | `/wogi-health` |

---

## Settings

### Recording Duration

```json
{
  "voice": {
    "defaultDuration": 30    // Max seconds
  }
}
```

### Audio Quality

```json
{
  "voice": {
    "sampleRate": 16000,     // Hz
    "channels": 1            // Mono
  }
}
```

---

## Local Model Setup

For offline voice recognition:

1. Install Whisper.cpp
2. Download model:
   ```bash
   # base.en is ~150MB
   ./models/download-model.sh base.en
   ```
3. Configure path:
   ```json
   {
     "voice": {
       "localModelPath": "/path/to/whisper/models/base.en"
     }
   }
   ```

---

## Best Practices

1. **Speak Clearly**: Enunciate command keywords
2. **Be Specific**: "Create button component" not "make a button"
3. **Use Keywords**: Start with action words (create, fix, show)
4. **Confirm Before Execute**: Review transcription
5. **Quiet Environment**: Reduces transcription errors

---

## Troubleshooting

### No Audio Detected

- Check microphone permissions
- Verify audio device is connected
- Test with system audio recorder

### Poor Transcription

- Use better microphone
- Reduce background noise
- Try different provider
- Speak slower and clearer

### Provider Errors

- Check API key is valid
- Verify provider is accessible
- Check rate limits

---

## Future Improvements

Planned enhancements:
- Wake word activation
- Continuous listening mode
- Voice feedback/responses
- Custom command mapping

---

## Related

- [Commands Reference](../../commands.md) - All available commands
- [Configuration](../configuration/all-options.md) - All settings
