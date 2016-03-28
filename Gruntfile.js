module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jsdox: {
      generate: {
        options: {
          contentsEnabled: true,
          contentsTitle: 'Bitcore Wallet Client Documentation',
          contentsFile: 'readme.md'
        },
        src: ['lib/*.js'],
        dest: 'docs'
      }, 
      publish: {
         enabled: true,
         path: '.',
         message: 'Markdown Auto-Generated for version <%= pkg.version %>',
         remoteName: 'b',
         remoteBranch: 'gh-pages2'
       }
    }
  });

  grunt.loadNpmTasks('grunt-jsdox');


  // Default task(s).
  grunt.registerTask('default', []);
};
