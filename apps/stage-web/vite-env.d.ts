interface ImportMetaEnv {
  readonly VITE_APP_TARGET_HUGGINGFACE_SPACE: boolean
  // more env variables...
  readonly VITE_FEATURE_CORE_PIPELINE?: boolean // experimental for core package pipline
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
