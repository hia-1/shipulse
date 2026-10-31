/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly BASE_URL: string
  readonly VITE_DEMO?: string
  readonly VITE_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}