/**
 * @file gulpfile.js
 *
 * Defines tasks that can be run on gulp.
 *
 * Summary:
 *  * test - Run tests
 *  * watch:test - Waits for filesystem changes and runs tests
 *
 */
'use strict';

var gulp = require('gulp');
var browserify = require('gulp-browserify');
var closureCompiler = require('gulp-closure-compiler');
var jsdoc = require('gulp-jsdoc');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var shell = require('gulp-shell');


var files = ['lib/**/*.js'];
var tests = ['test/**/*.js'];
var alljs = files.concat(tests);
var jsdocReadme = 'doc/README.md';


function ignoreError() {
  /* jshint ignore:start */ // using `this` in this context is weird 
  this.emit('end');
  /* jshint ignore:end */
}

var testMocha = function() {
  return gulp.src(tests).pipe(new mocha({
    reporter: 'spec'
  }));
};

var testKarma = shell.task([
  './node_modules/karma/bin/karma start --single-run --browsers Firefox'
]);


gulp.task('test', testMocha);

gulp.task('test-all', function(callback) {
  runSequence(['test'], ['karma'], callback);
});

gulp.task('test-nofail', function() {
  return testMocha().on('error', ignoreError);
});

gulp.task('watch:test', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['test-nofail']);
});

gulp.task('watch:lint', function() {
  // TODO: Only lint files that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['lint']);
});

gulp.task('watch:browser', function() {
  return gulp.watch(alljs, ['browser-all']);
});

gulp.task('coverage', shell.task(['istanbul cover _mocha -- --recursive']));

gulp.task('jsdoc', function() {
  return gulp.src(files.concat([jsdocReadme]))
    .pipe(jsdoc.parser())
    .pipe(jsdoc.generator('./apiref', {
      path: 'ink-docstrap',
      theme: 'flatly',
    }));
});

gulp.task('lint', function() {
  return gulp.src(alljs)
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('browser', function() {
  return gulp.src('index.js')
    .pipe(browserify({
      insertGlobals: true
    }))
    .pipe(rename('bitcore.js'))
    .pipe(gulp.dest('browser'));
});

gulp.task('browser-test', shell.task([
    'find test/ -type f -name "*.js" | xargs browserify -o ./browser/tests.js'
]));

gulp.task('browser-all', function(callback) {
  runSequence(['browser'], ['browser-test'], callback);
});

gulp.task('karma', testKarma);

gulp.task('minify', function() {
  return gulp.src('dist/bitcore.js')
    .pipe(closureCompiler({
      fileName: 'bitcore.min.js',
      compilerPath: 'node_modules/closure-compiler-jar/compiler.jar',
      compilerFlags: {
        language_in: 'ECMASCRIPT5',
        jscomp_off: 'suspiciousCode'
      }
    }))
    .pipe(gulp.dest('dist'));
});

gulp.task('default', function(callback) {
  return runSequence(['lint', 'jsdoc', 'browser', 'test'], ['coverage', 'minify'], callback);
});
