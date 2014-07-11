'use strict';

module.exports = function(grunt) {

  //Load NPM tasks
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-markdown');
  grunt.loadNpmTasks('grunt-shell');

  // Project Configuration
  grunt.initConfig({
    shell: {
      browserify: {
        options: {
          stdout: true,
          stderr: true
        },
        command: grunt.option('target') === 'dev' ?
            'node ./browser/build.js -a -d; docco lib/* ' : 'node ./browser/build.js -a'
      }
    },
    watch: {
      readme: {
        files: ['README.md', 'CONTRIBUTING.md'],
        tasks: ['markdown']
      },
      scripts: {
        files: ['**/*.js', '**/*.html', '!**/node_modules/**', '!browser/bundle.js', '!browser/testdata.js', '!docs/**', '!*.md', '!README.html', '!CONTRIBUTING.html'],
        tasks: ['shell'],
      },
    },
    mochaTest: {
      options: {
        reporter: 'spec',
      },
      src: ['test/*.js'],
    },
    markdown: {
      all: {
        files: [{
          expand: true,
          src: '*.md',
          dest: '.',
          ext: '.html'
        }]
      }
    }


  });

  grunt.registerTask('default', ['shell','watch']);

};
