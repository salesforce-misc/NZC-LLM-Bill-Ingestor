const lwcRecommended = require('@salesforce/eslint-config-lwc/recommended');
const auraPlugin = require('@salesforce/eslint-plugin-aura');
const lightningPlugin = require('@salesforce/eslint-plugin-lightning');
const pluginJest = require('eslint-plugin-jest');
const globals = require('globals');

module.exports = [
    ...lwcRecommended,
    ...auraPlugin.configs.recommended,
    {
        plugins: {
            '@salesforce/lightning': lightningPlugin,
        },
    },
    {
        files: ['*.test.js'],
        plugins: {
            jest: pluginJest,
        },
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
    {
        rules: {
            // Custom rules - only include rules that exist in the current plugin version
            '@lwc/lwc/no-api-reassignments': 'error',
            '@lwc/lwc/no-document-query': 'warn',
            '@lwc/lwc/no-inner-html': 'error',
            '@lwc/lwc/no-leading-uppercase-api-name': 'error',
            '@lwc/lwc/no-rest-parameter': 'error',
            '@lwc/lwc/prefer-custom-event': 'error',
            '@lwc/lwc/valid-api': 'error',
            '@lwc/lwc/valid-track': 'error',
            '@lwc/lwc/valid-wire': 'error',
        },
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            globals: {
                browser: true,
            },
        },
    },
];

