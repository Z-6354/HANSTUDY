/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  /** 构建时从 .env 注入的反馈 API 根地址，会打进安装包 */
  readonly MAIN_VITE_FEEDBACK_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}