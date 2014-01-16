#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var

  config  = require('../config/config'),
  Address = require('../app/models/Address');
  mongoose= require('mongoose');

    mongoose.connect(config.db);
var a = Address.new(process.argv[2]);
a.update(function(err) {
    console.log(a);
    mongoose.connection.close();
});
 
