const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');
module.exports = tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, { files:['src/**/*.ts','src/**/*.tsx','tests/**/*.ts'], languageOptions:{globals:{...globals.node,...globals.browser}}, rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':'off','no-empty':'off','@typescript-eslint/no-unused-expressions':'off'} }, { ignores:['dist','release','node_modules','.venv'] });
