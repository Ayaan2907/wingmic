import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({
  // Default OpenNext Cloudflare config: edge-style runtime + KV for ISR.
  // Override per-route in apps/web/next.config.ts if needed.
});
