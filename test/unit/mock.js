var mongoose = require('mongoose');

mongoose.Collection.prototype._insert = mongoose.Collection.prototype.insert;
// this method is propagated from node-mongodb-native
mongoose.Collection.prototype.insert = function(docs, options, callback) {
  // this is what the API would do if the save succeeds!
  callback(null, docs);
};

mongoose.mock = function() {
  mongoose.Collection.prototype.insert = function(docs, options, callback) {
    // this is what the API would do if the save succeeds!
    callback(null, docs);
  };
};

mongoose.unmock = function() {
  mongoose.Collection.prototype.insert = mongoose.Collection.prototype._insert;
};

module.exports = mongoose;
