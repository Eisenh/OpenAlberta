/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {

  readonly VITE_API_URL: string

  readonly VITE_QDRANT_URL: string
  readonly VITE_QDRANT_API_KEY: string
  readonly VITE_SUPABASE_SERVICE_ROLE_KEY: string
 
}


interface ImportMeta {

  readonly env: ImportMetaEnv

}
