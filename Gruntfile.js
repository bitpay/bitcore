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
          stdout: true
        },
        command: 'node ./browserify.js >  browser/bundle.js',
      },
      browserifyData: {
        options: {
          stdout: true
        },
        command: 'browserify  -t brfs  test/testdata.js  > browser/testdata.js'
      },
    },
    browserify: {
      test_data: {
        src: ['test/testdata.js'],
        dest: 'browser/testdata.js',
        options: {
          transform: ['brfs'],
          debug: true,
          standalone: 'testdata',
        }
      }
    },
    watch: {
      readme: {
        files: ['README.md'],
        tasks: ['markdown']
      },
      scripts: {
        files: ['**/*.js', '**/*.html', '!**/node_modules/**', '!browser/bundle.js', '!browser/testdata.js'],
        tasks: ['shell' /*, 'mochaTest'*/ ],
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
          src: 'README.md',
          dest: '.',
          ext: '.html'
        }]
      }
    }


  });

  grunt.registerTask('default', ['watch']);

};
