var base58check = require('./base58check');
var constants = require('./constants');
var util = require('util');
var Identity = require('./identity');

function Address() {

};

util.inherits( Address , Identity );



module.exports = Address;
