// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: 'https://9b7ba4106b2e033f3c0516dd8944cb61@o4511625891348480.ingest.de.sentry.io/4512408905056336',

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Turns off collection of data that could identify users. Adjust per category:
    // https://docs.sentry.io/platforms/javascript/configuration/options/#dataCollection
    dataCollection: {
        userInfo: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        httpBodies: [],
        httpHeaders: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        cookies: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    },
});
