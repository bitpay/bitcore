'use strict';

module.exports = function(grunt) {

  //Load NPM tasks
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-markdown');

  // Project Configuration
  grunt.initConfig({
    browserify: {
      client: {
        src: ['bitcore.js'],
        dest: 'browser/bundle.js',
        options: {
          debug: true,
          alias: [
            'browserify-bignum/bignumber.js:bignum',
            'browserify-buffertools/buffertools.js:buffertools'
          ],
          standalone: 'bitcore',
        }
      },
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
        files: ['**/*.js', '**/*.html', '!**/node_modules/**', '!browser/bundle.js', '!browser/load_test_data.js'],
        tasks: ['browserify' /*, 'mochaTest'*/ ],
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
