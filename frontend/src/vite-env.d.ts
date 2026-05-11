/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ERP_API_BASE_URL?: string;
  readonly VITE_ERP_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
