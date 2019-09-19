path = require 'path'

# Build configurations.
module.exports = (grunt) ->
    grunt.initConfig
        cmpnt: grunt.file.readJSON('bower.json'),
        banner: '/*! ngTableColumnResizable v<%= cmpnt.version %> by Vitalii Savchuk(esvit666@gmail.com) - ' +
                    'https://github.com/esvit/ng-table-resizable-columns - New BSD License */\n',
            
        # Deletes built file and temp directories.
        clean:
            working:
                src: [
                    'dist/ng-table-resizable-columns.*'
                ]

        uglify:
            # concat js files before minification
            js:
                src: ['dist/ng-table-resizable-columns.js']
                dest: 'dist/ng-table-resizable-columns.min.js'
                options:
                  banner: '<%= banner %>'
                  sourceMap: (fileName) ->
                    fileName.replace /\.js$/, '.map'

        cssmin:
            minify:
                options:
                    expand: true
                files:
                    "dist/ng-table-resizable-columns.min.css": ["dist/ng-table-resizable-columns.css"]

        concat:
            # concat js files before minification
            js:
                src: [
                    'src/scripts/*.js'
                ]
                dest: 'dist/ng-table-resizable-columns.js'
            # concat css files before minification
            css:
                src: [
                    'src/css/*.css'
                ]
                dest: 'dist/ng-table-resizable-columns.css'

    grunt.loadNpmTasks 'grunt-contrib-clean'
    grunt.loadNpmTasks 'grunt-contrib-copy'
    grunt.loadNpmTasks 'grunt-contrib-uglify'
    grunt.loadNpmTasks 'grunt-contrib-concat'
    grunt.loadNpmTasks 'grunt-contrib-cssmin'

    grunt.registerTask 'dev', [
        'clean'
        'concat'
    ]
    grunt.registerTask 'default', [
        'dev'
        'uglify'
        'cssmin'
    ]
