const { copyFileSync, mkdirSync } = require('node:fs');
const { dirname, join } = require('node:path');

const ASSETS = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
  'favicon-32x32.png',
  'favicon-16x16.png',
];

const source = dirname(require.resolve('swagger-ui-dist/swagger-ui.css'));
const target = join(__dirname, '..', 'public', 'docs');

mkdirSync(target, { recursive: true });

for (const asset of ASSETS) {
  copyFileSync(join(source, asset), join(target, asset));
}

console.log(`Copied ${ASSETS.length} Swagger assets to public/docs`);
