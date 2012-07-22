module.exports = function(grunt) {
  'use strict';
  grunt.initConfig({
    pkg: '<json:package.json>',
    test: {
      files: ['test/**/*.js']
    },
    lint: {
      files: ['Gruntfile.js', 'lib/**/*.js', 'test/**/*.js']
    },
    watch: {
      files: '<config:lint.files>',
      tasks: 'default'
    },
    jshint: {
      options: {
        node: true,
        globalstrict: true,
        sub: true
      },
      globals: {
        exports: true,
        process: true
      }
    }
  });
  grunt.registerTask('default', 'lint test');
};