'use strict';

module.exports = function(grunt) {

  //Load NPM tasks
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-test');

  // Project Configuration
  grunt.initConfig({
    browserify: {
      client: {
        src: ['bitcore.js'],
        dest: 'browser/bundle.js',
        options: {
          alias: ['browserify-bignum/bignumber.js:bignum'],
          standalone: 'bitcore'
        }
      }
    },
    watch: {
      scripts: {
        files: ['**/*.js', '**/*.html', '!**/node_modules/**', '!**/bundle.js'],
        tasks: ['browserify'/*, 'mochaTest'*/],
      },
    },
    mochaTest: {
      options: {
        reporter: 'spec',
      },
      src: ['test/*.js'],
    },

  });

  grunt.registerTask('default', ['watch']);

};

