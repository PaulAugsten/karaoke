const config = {
    branches: ['main'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        '@semantic-release/changelog',
        // Bumps package.json#version; flip npmPublish (and drop "private") to publish to npm.
        ['@semantic-release/npm', { npmPublish: false }],
        [
            '@semantic-release/git',
            {
                assets: ['package.json', 'CHANGELOG.md'],
                // biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release interpolates this string itself
                message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
            },
        ],
        '@semantic-release/github',
    ],
};

export default config;
