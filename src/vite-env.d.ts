/// <reference types="vite/client" />

interface Window {
  __MEDIAPIPE_MODEL_PATH__?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
