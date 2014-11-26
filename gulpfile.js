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
var istanbul = require('gulp-istanbul');
var jsdoc = require('gulp-jsdoc');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var shell = require('gulp-shell');
var tap = require('gulp-tap');

var files = ['lib/**/*.js'];
var tests = ['test/**/*.js'];
var alljs = files.concat(tests);
var jsdocReadme = 'doc/README.md';

function ignoreError() {
  /* jshint ignore:start */ // using `this` in this context is weird 
  this.emit('end');
  /* jshint ignore:end */
}

function testMocha() {
  return gulp.src(tests).pipe(new mocha({reporter: 'spec'}));
}

gulp.task('test', testMocha);

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

gulp.task('coverage', function() {
  gulp.src(files)
    .pipe(istanbul())
    .pipe(tap(function(f) {
       // Make sure all files are loaded to get accurate coverage data
       require(f.path);
    }))
    .on('end', testMocha.pipe(
      istanbul.writeReports('coverage')
    ));
});

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

gulp.task('browser-test', function() {
  return shell('find test/ -type f -name "*.js" | xargs browserify -o browser/tests.js');
});

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
