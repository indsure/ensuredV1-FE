/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;

  /** Mixpanel project token. Analytics + Session Replay are inert without it. */
  readonly VITE_MIXPANEL_TOKEN?: string;
  /** Data-center host. Defaults to India (https://api-in.mixpanel.com). */
  readonly VITE_MIXPANEL_API_HOST?: string;
  /** Replay sampling rate, 1 = 1%. Defaults to 100. */
  readonly VITE_MIXPANEL_RECORD_PERCENT?: string;
  /** Set to "true" to run Mixpanel from `vite dev` against a sandbox project. */
  readonly VITE_MIXPANEL_DEBUG?: string;
  /** Set to "true" to stop Mixpanel resolving geo from the request IP. */
  readonly VITE_MIXPANEL_DISABLE_IP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
