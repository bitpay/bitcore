#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var
  assert  = require('assert'),
  async   = require('async'),
  Sync     = require('../../lib/Sync').class();


var b = [
  '00000000c4cbd75af741f3a2b2ff72d9ed4d83a048462c1efe331be31ccf006b', //B#16
  '00000000fe198cce4c8abf9dca0fee1182cb130df966cc428ad2a230df8da743',
  '000000008d55c3e978639f70af1d2bf1fe6f09cb3143e104405a599215c89a48',
  '000000009b3bca4909f38313f2746120129cce4a699a1f552390955da470c5a9',
  '00000000ede57f31cc598dc241d129ccb4d8168ef112afbdc870dc60a85f5dd3', //B#20
];

var fix = function(s,cb) {
  async.each([1,2,3,4], function(i,c) {
    s.blockDb.setPrev(b[i],b[i-1], function() {
      return c();
    });
  }, cb);
};

var test = function(s,cb) {
  async.each([2,3,4], function(i,c) {
    s.blockDb.getPrev(b[i], function(err, p) {
      assert.equal(p,0);
      return c();
    });
  }, function() {
    s.blockDb.getPrev(b[1], function(err, p) {
      assert.equal(p,b[0]);
      return cb();
    });
  });
};



var s;
describe('Sync setOrphan', function(){

  before(function(done) {
    s = new Sync();
    fix(s,done);
  });

  after(function(done) {
    fix(s,done);
  });

  it('setOrphan', function(done) {
    this.timeout(100000);

    s.blockDb.has(b[0], function(err, has) {
      assert(has);
       s.blockDb.has(b[1], function(err, has) {
        assert(has);
        s.setOrphan(b[4],b[1], function() {
          test(s,done);
        });
      });
    });
  });
});

