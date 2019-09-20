var browserify = require('browserify');
var tsify = require('tsify');
const fs = require('fs');

const outputFile = fs.createWriteStream('./browser/browser.js')
 
browserify()
    .add('./src/index.ts')    
    .plugin(tsify, { project: '.' })
    .transform('browserify-shim')
    .bundle()
    .on('error', function (error) { console.error(error.toString()); })
    .pipe(outputFile);