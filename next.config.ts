import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    reactCompiler: true,
};

const withBundleAnalyzerConfig = withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

// org/project/authToken come from SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN.
// With them set, the build uploads source maps and creates a release tagged with the
// deploy's Git SHA; without them (e.g. local dev) the upload just no-ops.
export default withSentryConfig(withBundleAnalyzerConfig(nextConfig), {
    silent: !process.env.CI,
    widenClientFileUpload: true,
});
