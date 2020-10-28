const browserify = require('browserify');
const tsify = require('tsify');
const fs = require('fs');
const tsconfig = require('./tsconfig.json');

console.log('here');
browserify(
  ['./src/index.ts'],
  {
    outFile: './build/bundle.js',
    debug: true
  }
)
  .add('./src/index.ts')
  .plugin(tsify)
  .bundle((err, buf) => fs.writeFileSync('build/bundle.js', buf))
  // .pipe(fs.writeFileSync('build/bundle.js'))
  .on('error', (err) => console.error('builder error', err))
  .on('close', () => console.log('Done building.'))
  // .pipe(process.stdout);