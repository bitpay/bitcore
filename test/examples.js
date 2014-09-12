var should = require('chai').should();
var fs = require('fs');

describe('Examples', function() {

  var filenames = fs.readdirSync(__dirname + '/../examples/');

  filenames.forEach(function(filename) {

    if (filename.slice(filename.length - 3) === '.js') {

      describe(filename, function() {

        it('should not throw any errors', function() {
          (function() {
            var save = console.log;
            console.log = function() {};
            require('../examples/' + filename);
            console.log = save;
          }).should.not.throw();
        });

      });

    }

  });

});
