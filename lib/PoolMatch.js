'use strict';

require('classtool');

function spec(b) {

  var fs       = require('fs');
  var buffertools = require('buffertools');
  var db    = b.db || JSON.parse( fs.readFileSync(b.poolMatchFile || './poolMatchFile.json'));

  var PoolMatch = function() {
    var self = this;

    self.strings={};
    db.forEach(function(pool) {
      pool.searchStrings.forEach(function(s) {
        if (!self.strings[s]) self.strings[s] = [];
        self.strings[s].push(pool);
      });
    });
    Object.keys( self.strings, function(s) {
      delete self.strings[s].searchStrings;
    });
    self.stringsK = Object.keys(self.strings);
    self.stringsKl = self.stringsK.length;
  };


  PoolMatch.prototype.match = function(buffer) {
    var self = this;

    var match;
    var i =0;
    while (!match && i < self.stringsKl) {
      var k = self.stringsK[i++];
      if (  buffertools.indexOf(buffer,self.strings[k]) >= 0 ) {
        match = self.strings[k];
      }
    }
    return match;
  };

  return PoolMatch;
}
module.defineClass(spec);

 
