'use strict';

var gulp = require('gulp');
var litecoreTasks = require('litecore-build');

litecoreTasks('p2p', {skipBrowser: true});

gulp.task('default', ['lint', 'coverage']);
