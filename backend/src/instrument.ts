/**
 * Sentry instrumentation — MUST be imported FIRST in main.ts
 */
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const v = require('../../version.json');
      return `tecnikos-backend@${v.version}`;
    } catch {
      return undefined;
    }
  })(),
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Skip health checks and static assets
  ignoreTransactions: ['/health', '/favicon.ico'],
  // Don't send 4xx errors (expected business logic)
  beforeSend(event) {
    const status = event.contexts?.response?.status_code;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return null;
    }
    return event;
  },
});
