'use strict';

var HDPath = require('../lib/hdpath');

describe('HDPath model', function() {
  it('should have the correct constants', function() {
    HDPath.MAX_NON_HARDENED.should.equal(Math.pow(2, 31) - 1);
    HDPath.SHARED_INDEX.should.equal(HDPath.MAX_NON_HARDENED);
    HDPath.ID_INDEX.should.equal(HDPath.SHARED_INDEX - 1);
    HDPath.IdFullBranch.should.equal('m/45\'/2147483646/0/0');
  });

  it('should get the correct branches', function() {
    // shared branch (no cosigner index specified)
    HDPath.FullBranch(0, false).should.equal('m/45\'/2147483647/0/0');

    // copayer 0, address 0, external address (receiving)
    HDPath.FullBranch(0, false, 0).should.equal('m/45\'/0/0/0');

    // copayer 0, address 10, external address (receiving)
    HDPath.FullBranch(0, false, 10).should.equal('m/45\'/10/0/0');

    // copayer 0, address 0, internal address (change)
    HDPath.FullBranch(0, true, 0).should.equal('m/45\'/0/1/0');

    // copayer 0, address 10, internal address (change)
    HDPath.FullBranch(10, true, 0).should.equal('m/45\'/0/1/10');

    // copayer 7, address 10, internal address (change)
    HDPath.FullBranch(10, true, 7).should.equal('m/45\'/7/1/10');
  });

  [
    ['m/45\'/0/0/0', {
      index: 0,
      isChange: false
    }],
    ['m/45\'/0/0/1', {
      index: 1,
      isChange: false
    }],
    ['m/45\'/0/0/2', {
      index: 2,
      isChange: false
    }],
    ['m/45\'/0/1/0', {
      index: 0,
      isChange: true
    }],
    ['m/45\'/0/1/1', {
      index: 1,
      isChange: true
    }],
    ['m/45\'/0/1/2', {
      index: 2,
      isChange: true
    }],
    ['m/45\'/0/0/900', {
      index: 900,
      isChange: false
    }],
  ].forEach(function(datum) {
    var path = datum[0];
    var result = datum[1];
    it('should get the correct indexes for path ' + path, function() {
      var i = HDPath.indexesForPath(path);
      i.addressIndex.should.equal(result.index);
      i.isChange.should.equal(result.isChange);
    });
  });
});
