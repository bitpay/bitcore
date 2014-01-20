'use strict';

module.exports = function(grunt) {


  //Load NPM tasks
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-nodemon');
  grunt.loadNpmTasks('grunt-concurrent');
  grunt.loadNpmTasks('grunt-env');

  // Project Configuration
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      jade: {
        files: ['app/views/**'],
        options: {
          livereload: true,
        },
      },
      js: {
        files: ['Gruntfile.js', 'server.js', 'app/**/*.js', 'public/js/**'],
        tasks: ['jshint'],
        options: {
          livereload: true,
        },
      },
      html: {
        files: ['public/views/**'],
        options: {
          livereload: true,
        },
      },
      css: {
        files: ['public/css/**'],
        options: {
          livereload: true
        }
      },
        // we monitor only app/models/* because we have test for models only now
//      test: {
//        files: ['test/**/*.js', 'test/*.js','app/models/*.js'],
//        tasks: ['test'],
//      }
    },
    jshint: {
      all: {
        src: ['Gruntfile.js', 'server.js', 'app/**/*.js', 'public/js/**','lib/*.js'],
        options: {
          jshintrc: true
        }
      }
    },
    mochaTest: {
      options: {
        reporter: 'spec',
      },
      src: ['test/**/*.js'],
    },

    nodemon: {
      dev: {
        script: 'server.js',
        options: {
          args: [],
          ignore: ['public/**', 'test/**','util/**'],
          // nodeArgs: ['--debug'],
          delayTime: 1,
          env: {
            PORT: 3000
          },
          cwd: __dirname
        }
      }
    },
    concurrent: {
      tasks: ['nodemon', 'watch'],
      options: {
        logConcurrentOutput: true
      }
    },
    env: {
      test: {
        NODE_ENV: 'test'
      }
    }
  });

  //Making grunt default to force in order not to break the project.
  grunt.option('force', true);

  //Default task(s).
  grunt.registerTask('default', ['jshint','concurrent']);

  //Test task.
  grunt.registerTask('test', ['env:test', 'mochaTest']);
};
