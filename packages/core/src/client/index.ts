import type { ConfigService } from '../config/service'
import type { AiriPlugin } from '../plugin'
import type { MessageChannel } from '../primitives/message-channel'
import type { ModelProvider, ProviderRequest } from '../primitives/model-provider'

import { PluginRegistry } from '../plugin/registry'

export interface CoreDeps {
  channel?: MessageChannel // Optional, depending on use case
  providers?: Record<string, ModelProvider>
  plugins?: AiriPlugin[]
  config: ConfigService
}

export class CoreClient {
  constructor(private deps: CoreDeps, private registry = new PluginRegistry()) {}

  async init() {
    // register Provider
    for (const provider of Object.values(this.deps.providers ?? {})) this.registry.registerProvider(provider as ModelProvider)
    // load plugins
    if (this.deps.plugins?.length)
      await this.registry.load(this.deps.plugins)
    return this
  }

  // Use a provider to make a request
  async request(providerId: string, req: ProviderRequest) {
    // Get provider
    const provider = this.registry.getProvider(providerId)
    if (!provider)
      throw new Error(`Provider not found: ${providerId}`)

    // Input precessing - before sending to provider
    const processed = await this.registry.applyInput(req)

    // Support both streaming and unary providers
    let result: unknown
    if ('stream' in provider) {
      const chunks: unknown[] = []
      // Streaming to provider
      await provider.stream(
        processed as ProviderRequest,
        (c) => { chunks.push(c) },
      )
      result = chunks
    }
    else {
      // Unary request to provider
      result = await provider.request(processed as ProviderRequest)
    }

    // Output processing - after receiving from provider
    const output = await this.registry.applyOutput(result)
    return output
  }

  get config() {
    return this.deps.config
  }

  get channel() {
    return this.deps.channel
  }
}
