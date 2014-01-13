#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var 
  assert  = require('assert'),
  fs  = require('fs'),
  config  = require('../../config/config'),
  Address = require('../../app/models/Address');
  mongoose= require('mongoose'),
  config       = require('../../config/config');

var addrValid = JSON.parse(fs.readFileSync('test/model/addr.json'));

describe('Address update', function(){

  before(function(done) {
    mongoose.connect(config.db);
    done();
  });

  after(function(done) {
    mongoose.connection.close();
    done();
  });

  addrValid.forEach( function(v) {
    if (v.disabled) {
        console.log(v.addr + " => disabled in JSON");
    }
    else {
        it('should retrieve the correct info for:' + v.addr, function(done) {
        this.timeout(5000);
        
        var a = Address.new(v.addr);


        a.update(function(err) {
          if (err) done(err);

          assert.equal(v.addr, a.addrStr);
          if (v.balance) assert.equal(v.balance, a.balance);
          if (v.totalReceived) assert.equal(v.totalReceived, a.totalReceived);
          if (v.totalSent) assert.equal(v.totalSent, a.totalSent);
          if (v.transactions) {
            v.transactions.forEach( function(tx) {
              assert(tx in a.inTransactions);
            });
          }
          done();
        });
        });
    }
  });

});

