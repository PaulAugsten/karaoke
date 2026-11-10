import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.{ts,tsx}'],
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['app/**', 'components/**', 'lib/**'],
            // Layouts render <html>/<body>; they're covered by the Playwright suite instead.
            exclude: ['app/**/layout.tsx'],
            // A floor that gates regressions, not a target: ratchet these up as
            // coverage improves rather than treating them as a ceiling.
            thresholds: {
                statements: 50,
                branches: 50,
                functions: 50,
                lines: 50,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, '.'),
        },
    },
});
