'use strict';

var gulp = require('gulp');
var gulp_bitcore = require('gulp-bitcore');

gulp_bitcore('p2p', {skipBrowser: true});

gulp.task('default', ['lint', 'coverage']);
