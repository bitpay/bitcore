'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var t = require('../lib/bchaddresstranslator');

describe('BCH Address translator', function() {
 
  describe('#getAddressCoin', function() {
    it('should identify btc as coin for 1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', function() {
      t.getAddressCoin('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA').should.equal('legacy');
    });
    it('should identify bch as coin for CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz', function() {
      t.getAddressCoin('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz').should.equal('copay');
    });
    it('should return null for 1L', function() {
      should.not.exist(t.getAddressCoin('1L'));
    });
  });
 

  describe('#translateAddress', function() {
    it('should translate address from btc to bch', function() {
      var res = t.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'copay');
      res.should.equal('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
    });
    it('should translate address from bch to btc', function() {
      var res = t.translate('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS', 'legacy');
      res.should.equal('36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
    });
 
    it('should keep the address if there is nothing to do (bch)', function() {
      var res = t.translate('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz', 'copay');
      res.should.equal('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
    });
    it('should keep the address if there is nothing to do (btc)', function() {
      var res = t.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'legacy');
      should.exist(res);
      res.should.equal('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
    });
  });
});

