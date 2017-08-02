const mongoose = require('mongoose');
const config = require('../../config/config.js');

mongoose.connect(config.mongodb.uri, config.mongodb.options);

module.exports = mongoose;
