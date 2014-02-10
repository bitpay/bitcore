'use strict';

module.exports = function(grunt) {

  //Load NPM tasks
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-css');
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
        files: ['Gruntfile.js', 'insight.js', 'app/**/*.js', 'public/js/**'],
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
        src: ['Gruntfile.js', 'insight.js', 'app/**/*.js', 'public/src/js/**/*.js','lib/*.js'],
        options: {
          jshintrc: true
        }
      }
    },
    concat: {
      options: {
        process: function(src, filepath) {
          if (filepath.substr(filepath.length - 2) === 'js') {
            return '// Source: ' + filepath + '\n' +
              src.replace(/(^|\n)[ \t]*('use strict'|"use strict");?\s*/g, '$1');
          } else {
            return src; 
          }
        }
      },
      vendors: {
        src: ['public/lib/momentjs/min/moment.min.js', 'public/lib/qrcode-generator/js/qrcode.js', 'public/lib/zeroclipboard/ZeroClipboard.min.js'],
        dest: 'public/js/vendors.js'
      },
      angular: {
        src: ['public/lib/angular/angular.min.js', 'public/lib/angular-resource/angular-resource.min.js', 'public/lib/angular-route/angular-route.min.js', 'public/lib/angular-qrcode/qrcode.js', 'public/lib/angular-animate/angular-animate.min.js', 'public/lib/angular-bootstrap/ui-bootstrap.min.js', 'public/lib/angular-bootstrap/ui-bootstrap-tpls.min.js', 'public/lib/angular-ui-utils/ui-utils.min.js', 'public/lib/ngprogress/build/ngProgress.min.js'],
        dest: 'public/js/angularjs-all.js'
      },
      main: {
        src: ['public/src/js/app.js', 'public/src/js/controllers/*.js', 'public/src/js/services/*.js', 'public/src/js/directives.js', 'public/src/js/filters.js', 'public/src/js/config.js', 'public/src/js/init.js'],
        dest: 'public/js/main.js'
      },
      css: {
        src: ['public/lib/ngprogress/ngProgress.css', 'public/src/css/**/*.css'],
        dest: 'public/css/main.css'
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= pkg.version %> */\n',
        mangle: false
      },
      vendors: {
        src: 'public/js/vendors.js',
        dest: 'public/js/vendors.min.js'
      },
      angular: {
        src: 'public/js/angularjs-all.js',
        dest: 'public/js/angularjs-all.min.js'
      },
      main: {
        src: 'public/js/main.js',
        dest: 'public/js/main.min.js'
      }
    },
    cssmin: {
      css: {
        src: 'public/css/main.css',
        dest: 'public/css/main.min.css'
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
        script: 'insight.js',
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
  grunt.registerTask('default', ['jshint', 'concurrent']);
  
  //Compile task (concat + minify)
  grunt.registerTask('compile', ['concat', 'uglify', 'cssmin']);
      
  //Test task.
  grunt.registerTask('test', ['env:test', 'mochaTest']);
};
