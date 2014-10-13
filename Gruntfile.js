'use strict';

module.exports = function(grunt) {

  //Load NPM tasks
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-css');
  grunt.loadNpmTasks('grunt-markdown');
  grunt.loadNpmTasks('grunt-macreload');
  grunt.loadNpmTasks('grunt-angular-gettext');

  // Project Configuration
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
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
        src: ['public/src/js/ios-imagefile-megapixel/megapix-image.js', 'public/lib/qrcode-generator/js/qrcode.js', 'public/src/js/jsqrcode/grid.js', 'public/src/js/jsqrcode/version.js', 'public/src/js/jsqrcode/detector.js', 'public/src/js/jsqrcode/formatinf.js', 'public/src/js/jsqrcode/errorlevel.js', 'public/src/js/jsqrcode/bitmat.js', 'public/src/js/jsqrcode/datablock.js', 'public/src/js/jsqrcode/bmparser.js', 'public/src/js/jsqrcode/datamask.js', 'public/src/js/jsqrcode/rsdecoder.js', 'public/src/js/jsqrcode/gf256poly.js', 'public/src/js/jsqrcode/gf256.js', 'public/src/js/jsqrcode/decoder.js', 'public/src/js/jsqrcode/qrcode.js', 'public/src/js/jsqrcode/findpat.js', 'public/src/js/jsqrcode/alignpat.js', 'public/src/js/jsqrcode/databr.js', 'public/lib/momentjs/min/moment.min.js', 'public/lib/moment/lang/es.js', 'public/lib/zeroclipboard/ZeroClipboard.min.js'],
        dest: 'public/js/vendors.js'
      },
      angular: {
        src: ['public/lib/angular/angular.min.js', 'public/lib/angular-resource/angular-resource.min.js', 'public/lib/angular-route/angular-route.min.js', 'public/lib/angular-qrcode/qrcode.js', 'public/lib/angular-animate/angular-animate.min.js', 'public/lib/angular-bootstrap/ui-bootstrap.js', 'public/lib/angular-bootstrap/ui-bootstrap-tpls.js', 'public/lib/angular-ui-utils/ui-utils.min.js', 'public/lib/ngprogress/build/ngProgress.min.js', 'public/lib/angular-gettext/dist/angular-gettext.min.js', 'public/lib/angular-moment/angular-moment.min.js'],
        dest: 'public/js/angularjs-all.js'
      },
      main: {
        src: ['public/src/js/app.js', 'public/src/js/controllers/*.js', 'public/src/js/services/*.js', 'public/src/js/directives.js', 'public/src/js/filters.js', 'public/src/js/config.js', 'public/src/js/init.js', 'public/src/js/translations.js'],
        dest: 'public/js/main.js'
      },
      css: {
        src: ['public/lib/bootstrap/dist/css/bootstrap.min.css', 'public/src/css/**/*.css'],
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
    markdown: {
      all: {
        files: [
         {
           expand: true,
           src: 'README.md',
           dest: '.',
           ext: '.html'
         }
        ]
      }
    },
    macreload: {
      chrome: {
        browser: 'chrome',
        editor: 'macvim'
      }
    },
    watch: {
      main: {
        files: ['public/src/js/**/*.js'],
        tasks: ['concat:main', 'uglify:main'],
      },
      css: {
        files: ['public/src/css/**/*.css'],
        tasks: ['concat:css', 'cssmin'],
      },
    },
    nggettext_extract: {
      pot: {
        files: {
          'po/template.pot': ['public/views/*.html', 'public/views/**/*.html']
        }
      },
    },
    nggettext_compile: {
      all: {
        options: {
          module: 'insight'
        },
        files: {
          'public/src/js/translations.js': ['po/*.po']
        }
      },
    }
  });

  //Making grunt default to force in order not to break the project.
  grunt.option('force', true);

  //Default task(s).
  grunt.registerTask('default', ['watch']);

  //Update .pot file
  grunt.registerTask('translate', ['nggettext_extract']);

  //Compile task (concat + minify)
  grunt.registerTask('compile', ['nggettext_compile', 'concat', 'uglify', 'cssmin']);


};
