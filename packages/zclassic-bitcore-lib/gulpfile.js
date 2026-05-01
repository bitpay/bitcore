var startGulp = require('bitcore-build');
var gulp = require('gulp');
var tasks = startGulp('lib');

// Override the default task to skip browser tests (Karma failing)
gulp.task('default', tasks['test:node']);

module.exports = tasks;
