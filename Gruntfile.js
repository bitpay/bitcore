'use strict';

module.exports = function(grunt) {

  //Load NPM tasks
  grunt.loadNpmTasks('grunt-browserify');

  // Project Configuration
  grunt.initConfig({
    browserify: {
      basic: {
        src: ['main2.js'],
        dest: 'browser/bundle.js'
      }
    }
  });

  grunt.registerTask('default', ['browserify']);

};
