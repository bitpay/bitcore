var fs = require('fs')

function FileStorage(opts) {
  if (!opts.filename) {
    throw new Error('Please set wallet filename');
  }
  this.filename = opts.filename;
  this.fs = opts.fs || fs;
};

FileStorage.prototype.getName = function() {
  return this.filename;
};

FileStorage.prototype.save = function(data, cb) {
  this.fs.writeFile(this.filename, JSON.stringify(data), cb);
};

FileStorage.prototype.load = function(cb) {
  this.fs.readFile(this.filename, 'utf8', function(err, data) {
    if (err) return cb(err);
    try {
      data = JSON.parse(data);
    } catch (e) {}
    return cb(null, data);
  });
};

FileStorage.prototype.exists = function(cb) {
  fs.exists(this.filename, cb);
};

module.exports = FileStorage;
