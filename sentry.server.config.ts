import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Sample a fraction of traces in production to stay within the Sentry quota.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Spans for Server Actions, route handlers, SSR; this is the OpenTelemetry data,
    // Sentry's SDK runs an OTEL pipeline under the hood and reports through here.
    debug: false,
});
