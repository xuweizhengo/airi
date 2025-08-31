import type { ModelProvider } from '../primitives/model-provider'

export interface AiriPluginContext {
  registerInputProcessor: (proc: (x: unknown) => Promise<unknown> | unknown) => void
  registerOutputProcessor: (proc: (x: unknown) => Promise<unknown> | unknown) => void
  registerProvider: (p: ModelProvider) => void
  // 未来：仅声明 UI Widget 元信息，不绑定具体框架
  registerWidget?: (decl: unknown) => void
}

export interface AiriPlugin {
  id: string
  setup: (ctx: AiriPluginContext) => void | Promise<void>
}
