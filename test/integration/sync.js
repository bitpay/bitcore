#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var
  assert  = require('assert'),
  async   = require('async'),
  HistoricSync     = require('../../lib/HistoricSync').class();


var s;
var b = [
  '00000000c4cbd75af741f3a2b2ff72d9ed4d83a048462c1efe331be31ccf006b', //0 B#16
  '00000000fe198cce4c8abf9dca0fee1182cb130df966cc428ad2a230df8da743', //1
  '000000008d55c3e978639f70af1d2bf1fe6f09cb3143e104405a599215c89a48', //2
  '000000009b3bca4909f38313f2746120129cce4a699a1f552390955da470c5a9', //3
  '00000000ede57f31cc598dc241d129ccb4d8168ef112afbdc870dc60a85f5dd3', //4 B#20
];
var t = [
  'd08582d3711f75d085c618874fb0d049ae09d5ec95ec6f5abd289f4b54712c54', // TX from B#16
  '1729001087e0cebea8d14de1653d5cf59628d9746bc1ae65f776f1cbaff7ebad',
  'cf53d7ccd83a099acfbc319ee10c1e3b10e3d42ba675b569fdd6b69cb8d2db4e',
  'cf53d7ccd83a099acfbc319ee10c1e3b10e3d42ba675b569fdd6b69cb8d2db4e',
  'd45f9da73619799e9d7bd03cc290e70875ea4cbad56b8bffa15135fbbb3df9ea', //4 Tx from B20
];

var test = function(cb) {
  async.each([2,3,4], function(i,c) {
    s.sync.bDb.getPrev(b[i], function(err, p) {
      assert.equal(p,b[i-1]);
      return c();
    });
    }, function() {
      async.each([0,1,2,3,4], function(i,c) {
          s.sync.bDb.has(b[i], function(err, p) {
              assert(p);
              return c();
          });
      }, function() {
          async.each([0,1,2,3], function(i,c) {
              s.sync.bDb.getNext(b[i], function(err, p) {
                  assert.equal(p,b[i+1]);
                  return c();
              });
          }, cb);
      });
  });
};

describe('Sync checkOrphan', function(){

  before(function(done) {
    s = new HistoricSync();
    s.init({}, function(err) {
        if (err) return done(err);
        s.sync.destroy(done);
    });
  });

  it('simple RPC forward syncing', function(done) {
      s.getPrevNextBlock(s.genesis,b[4], {
          next: true,
      }, function(err) {
          if (err) return done(err);
          test(done);
      });
  });


  it('reorg, case 1', function(done) {
      var case1 = {
          hash: '0000000000000000000000000000000000000000000000000000000000000001',
          tx: [ '1000000000000000000000000000000000000000000000000000000000000000' ],
          time: 1296690099,
          previousblockhash: b[2],
      };

      async.series([
        function (c) {
        s.sync.txDb.isConfirmed(t[0], function(err,is) {
          assert(!err);
          assert(is);
          return c();
        });
        },
        function (c) {
          s.sync.txDb.isConfirmed(t[4], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.storeTipBlock(case1, function(err) {
            assert(!err, 'shouldnt return error' + err);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.isMain(b[2], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.isMain(b[3], function(err,is) {
            assert(!err);
            assert(!is, b[3] + 'should not be on main chain');
            return c();
          });
        },
        function (c) {
          s.sync.bDb.isMain(b[4], function(err,is) {
            assert(!err);
            assert(!is);
            return c();
          });
        },
        function (c) {
        s.sync.txDb.isConfirmed(t[0], function(err,is) {
          assert(!err);
          assert(is);
          return c();
        });
        },
        function (c) {
          s.sync.txDb.isConfirmed(t[4], function(err,is) {
            assert(!err);
            assert(!is);
            return c();
          });
        },
 
        ], done );
  });
});


