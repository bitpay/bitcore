'use strict';

var BlockDb = require('../../lib/BlockDb').class();
var height_needed = 180000;
var bDb = new BlockDb();

var expect = require('chai').expect;

describe('Node check', function() {
  it('should contain block ' + height_needed, function(done) {
    bDb.blockIndex(height_needed, function(err, b) {
      expect(err).to.equal(null);
      expect(b).to.not.equal(null);
      done();
    });
  });
});
