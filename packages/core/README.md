# @proj-airi/core (MVP)

Headless runtime for AIRI with pluggable Providers, Channels and Processing pipeline.

- No Vue/Pinia dependency.
- UI shells (stage-web / tamagotchi) talk to Core via a thin bridge.
- Config validated by `zod`, storage provided by an injected backend.

> PR-1 contains *only* new files. No existing imports/paths are touched.

```
packages/core/
  src/
    primitives/
      input.ts          // Input & InputProcessor
      output.ts         // Output & OutputProcessor
      model-provider.ts // Chat / TTS / STT / VAD general interface
      message-channel.ts// IPC/WebSocket/WebRTC abstraction
      scene.ts          // Renderer/SceneControl/BodyControl abstraction
    config/
      schema.ts         // zod/yup configuration Schema
      service.ts        // get/set/subscribe storage adapter/backend
    plugin/
      index.ts          // plugin interface definition & Hook bus
      registry.ts       // runtime registry
    client/
      index.ts          // Stateless Client

```
