
var fs = require('fs')

function FileStorage(opts) {
  if (!opts.filename) {
    throw new Error('Please set the config filename');
  }
  this.filename = opts.filename;
};


FileStorage.prototype.save = function(data) {
  fs.writeFileSync(this.filename, JSON.stringify(data));
};

FileStorage.prototype.load = function() {
  try {
    return JSON.parse(fs.readFileSync(this.filename));
  } catch (ex) {}
};


module.exports = FileStorage;

