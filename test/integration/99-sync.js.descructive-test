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
  '1729001087e0cebea8d14de1653d5cf59628d9746bc1ae65f776f1cbaff7ebad', //1
  'cf53d7ccd83a099acfbc319ee10c1e3b10e3d42ba675b569fdd6b69cb8d2db4e', //2
  '73a4988adf462b6540cfa59097804174b298cfa439f73c1a072c2c6fbdbe57c7', //3
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

/*
 * TEST CASES
 *
 *  Blocks:  0-1-2-3-4
 *  case 1)
 *           0-1-2-3-4
 *                \
 *                 C1*
 *
 *  case 2)
 *           0-1-2---3-4
 *                \   \
 *                 C1  C2*
 *
 *  case 2b)
 *           0-1-2---3-4
 *                \   \
 *                 C1  C2-C2b(TX=C1.TX)*
 *  case 2c)
 *           0-1-2---3-4
 *                \   \
 *                 C1  C2-C2b(TX=C1.TX)
 *                  \
 *                   C2c(TX=C2.TX)*
 *
 */

describe('Sync Reorgs', function(){

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

  var case1 = {
    hash: '0000000000000000000000000000000000000000000000000000000000000001',
    tx: [ 'f0596531810160d090813673b4a397f4617aab44eb26c7f06c8a766eac984b91' ],
    time: 1296690099,
    previousblockhash: b[2],
  };


  it('reorg, case 1', function(done) {
      async.series([
        function (c) {
        s.sync.txDb.isConfirmed(t[0], function(err,is) {
          assert(!err);
          assert(is);
          return c();
        });
        },
        function (c) {
          s.sync.txDb.isConfirmed(t[3], function(err,is) {
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
        s.sync.txDb.isConfirmed(t[3], function(err,is) {
          assert(!err);
          assert(!is);
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
        function (c) {
          s.sync.txDb.isConfirmed(case1.tx[0], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        ], done );
  });

  it('reorg, case 1 (repeat)', function(done) {
    s.sync.storeTipBlock(case1, function(err) {
      assert(!err, 'shouldnt return error' + err);
      return done();
    });
  });

  var case2 = {
    hash: '0000000000000000000000000000000000000000000000000000000000000002',
    tx: [  '99bb359a4b12a588fcb9e59e5e8d92d593ce7a56d2ba42085fe86d9a0b4fde15' ],
    time: 1296690099,
    previousblockhash: b[3],
  };


  it('reorg, case 2', function(done) {
      async.series([
        function (c) {
        s.sync.txDb.isConfirmed(t[0], function(err,is) {
          assert(!err);
          assert(is);
          return c();
        });
        },
        function (c) {
          s.sync.txDb.isConfirmed(case1.tx[0], function(err,is) {
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
        function (c) {
          s.sync.storeTipBlock(case2, function(err) {
            assert(!err, 'shouldnt return error' + err);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.isMain(b[3], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.isMain(b[4], function(err,is) {
            assert(!err);
            assert(!is, b[3] + 'should not be on main chain');
            return c();
          });
        },
        function (c) {
          s.sync.bDb.isMain(case1.hash, function(err,is) {
            assert(!err);
            assert(!is);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.isMain(case2.hash, function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.txDb.isConfirmed(t[3], function(err,is) {
            assert(!err);
            assert(is, 'transaction t[3] should be valid:' + t[3]);
            return c();
          });
        },
        function (c) {
        s.sync.txDb.isConfirmed(case1.tx[0], function(err,is) {
          assert(!err);
          assert(!is);
          return c();
        });
        },
         function (c) {
          s.sync.txDb.isConfirmed(case2.tx[0], function(err,is) {
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
        function (c) {
          s.sync.bDb.getNext(b[2], function(err, val) {
            assert(!err);
            assert.equal(val,b[3]);
            return c();
          });
        },



        ], done );
  });


  var case2b = {
    hash: '0000000000000000000000000000000000000000000000000000000000000003',
    tx: case1.tx,
    time: 1296690099,
    previousblockhash: case2.hash,
  };

  it('reorg, case 2b', function(done) {
      async.series([
        function (c) {
        s.sync.txDb.isConfirmed(case2b.tx[0], function(err,is) {
          assert(!err);
          assert(!is);
          return c();
        });
        },
        function (c) {
          s.sync.storeTipBlock(case2b, function(err) {
            assert(!err, 'shouldnt return error' + err);
            return c();
          });
        },
        function (c) {
          s.sync.txDb.isConfirmed(t[3], function(err,is) {
            assert(!err);
            assert(is, 'transaction t[3] should be valid:' + t[3]);
            return c();
          });
        },
        function (c) {
        s.sync.txDb.isConfirmed(case2b.tx[0], function(err,is) {
          assert(!err);
          assert(is);
          return c();
        });
        },
        ], done );
  });



  var case2c = {
    hash: '0000000000000000000000000000000000000000000000000000000000000004',
    tx: case2.tx,
    time: 1296690099,
    previousblockhash: case1.hash,
  };

  it('reorg, case 2c', function(done) {
      async.series([
        function (c) {
          s.sync.txDb.isConfirmed(case1.tx[0], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.isMain(case1.hash, function(err,is) {
            assert(!err);
            assert(!is, 'case1 block shouldnt be main:' + case1.hash);
            return c();
          });
        },
        function (c) {
          s.sync.txDb.isConfirmed(case2c.tx[0], function(err,is) {
            assert(!err);
            assert(is);   //It was there before (from case2)
            return c();
          });
        },
        function (c) {
          s.sync.storeTipBlock(case2c, function(err) {
            assert(!err, 'shouldnt return error' + err);
            return c();
          });
        },
        function (c) {
          s.sync.txDb.isConfirmed(case1.tx[0], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.has(case1.hash, function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.has(case2c.hash, function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.txDb.isConfirmed(case2c.tx[0], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.txDb.isConfirmed(t[3], function(err,is) {
            assert(!err);
            assert(!is, 'TX t[3]: shouldnt be confirmed:' + t[3] +':'+ is);
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
        function (c) {
          s.sync.txDb.isConfirmed(case2.tx[0], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
 
        ], done );
  });

  var case3  = {
    hash: '0000000000000000000000000000000000000000000000000000000000000005',
    tx: case2.tx,
    time: 1296690099,
    previousblockhash: '666',
  };

  it('reorg, case 3)', function(done) {
      async.series([
        function (c) {
          s.sync.storeTipBlock(case3, function(err) {
            assert(!err, 'shouldnt return error' + err);
            return c();
          });
        },

        //shoudnt change anything
        function (c) {
          s.sync.txDb.isConfirmed(case1.tx[0], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.has(case1.hash, function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.has(case2c.hash, function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.txDb.isConfirmed(case2c.tx[0], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.txDb.isConfirmed(t[3], function(err,is) {
            assert(!err);
            assert(!is, 'TX t[3]: shouldnt be confirmed:' + t[3] +':'+ is);
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
        function (c) {
          s.sync.txDb.isConfirmed(case2.tx[0], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
 
        ], done );
  });

  var p2p  = {
    hash: '0000000000000000000000000000000000000000000000000000000000000006',
    tx: ['f6c2901f39fd07f2f2e503183d76f73ecc1aee9ac9216fde58e867bc29ce674e'],
    time: 1296690099,
    previousblockhash: '111',
  };

  it('p2p, no reorg allowed', function(done) {
      async.series([
        function (c) {
          s.sync.storeTipBlock(p2p, false, function(err) {
            assert(!err, 'shouldnt return error' + err);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.has(p2p.hash, function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.txDb.isConfirmed(p2p.tx[0], function(err,is) {
            assert(!err);
            assert(is);
            return c();
          });
        },
        function (c) {
          s.sync.bDb.getNext(p2p.hash, function(err,v) {
            assert(!err);
            assert.equal(v,p2p.nextblockhash);
            return c();
          });
        },
         function (c) {
          s.sync.bDb.getNext(p2p.previousblockhash, function(err,v) {
            assert(!err);
            assert.equal(v,p2p.hash);
            return c();
          });
        },
 
        ], done );
  });
});


