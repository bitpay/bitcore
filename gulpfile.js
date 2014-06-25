var gulp = require('gulp'),
    concat = require('gulp-concat'),
    path = require('path'),
    es = require('event-stream');

var format = es.through(
    function (file) {
        if (file.isNull()) return this.emit('data', file); // pass along
        if (file.isStream()) return this.emit('error', new Error('Streaming not supported'));

        //add indentation
        var contents = "\t" + file.contents.toString("utf8").split("\n").join("\n\t");
        //add header
        contents = ["#", path.basename(file.path), "\n", contents].join("");
        file.contents = new Buffer(contents, "utf8");
        this.emit('data', file);
    });

gulp.task('examples', function () {
    //concat .js files from ./examples folder into ./examples.md
    return gulp.src("./examples/*.js").pipe(format).pipe(concat('examples.md')).pipe(gulp.dest('./'));
});


gulp.task('default', ["examples"]);
