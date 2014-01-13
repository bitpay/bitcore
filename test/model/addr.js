#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var 
  assert  = require('assert'),
  fs  = require('fs'),
  config  = require('../../config/config'),
  Address = require('../../app/models/Address').class();
  mongoose= require('mongoose'),
  addrValid = JSON.parse(fs.readFileSync('test/model/addr.json'));

describe('Address balances', function(){

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
        it('Info for:' + v.addr, function(done) {
        this.timeout(5000);
        
        var a = new Address(v.addr);

        a.update(function(err) {
          if (err) done(err);
          assert.equal(v.addr, a.addrStr);
          console.log("TX count:" + a.transactions.length);

          if (v.balance) assert.equal(v.balance, a.balance);
          if (v.totalReceived) assert.equal(v.totalReceived, a.totalReceived);
          if (v.totalSent) assert.equal(v.totalSent, a.totalSent);
          if (v.transactions) {
            v.transactions.forEach( function(tx) {
              assert(tx in a.transactions);
            });
          }
          done();
        });
        });
    }
  });

});

