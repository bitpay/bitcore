module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jsdoc: {
      dist: {
        src: ['lib/*.js'],
        options: {
          destination: 'docs',
        }
      }
    },
    jsdoc2md: {
      dist: {
        src: "lib/*.js",
        dest: "docs/api.md"
      },
    }
  });

  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks("grunt-jsdoc-to-markdown");

  // Default task(s).
  grunt.registerTask('default', []);
};
