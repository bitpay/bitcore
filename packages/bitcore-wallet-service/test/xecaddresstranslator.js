'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var x = require('../ts_build/lib/xecaddresstranslator');

describe('XEC Address translator', function() {

  describe('#getAddressCoin', function() {
    it('should identify btc as coin for 1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', function() {
      x.getAddressCoin('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA').should.equal('legacy');
    });
    it('should identify xec as coin for ecash:qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gzanm5xjj', function() {
      x.getAddressCoin('ecash:qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gzanm5xjj').should.equal('cashaddr');
    });
    it('should return null for 1L', function() {
      should.not.exist(x.getAddressCoin('1L'));
    });
  });


  describe('#translateAddress', function() {
    it('should translate address from btc to xec', function() {
      var res = x.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'cashaddr');
      res.should.equal('qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gzanm5xjj');
    });
    it('should translate address from xec to btc', function() {
      var res = x.translate('ecash:pqu9c0xe7g0ngz9hzpky64nva9790m64esltxsrkvp', 'legacy');
      res.should.equal('36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
    });

    it('should keep the address if there is nothing to do (xec)', function() {
      var res = x.translate('ecash:qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gzanm5xjj', 'cashaddr');
      res.should.equal('ecash:qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gzanm5xjj');
    });
    it('should keep the address if there is nothing to do (btc)', function() {
      var res = x.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'legacy');
      should.exist(res);
      res.should.equal('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
    });
    it('should filter out broken addreseses', function() {
      var res = x.translate(['qq2qkh9gs99326ytdg334lvhh999ke9mwg4u669eec','pepe', 123,'qq2qkh9gs99326ytdg334lvhh999ke9mwg4u669eec', 'false' ], 'copay');
      res.should.deep.equal(['12pz8H9mejW1X3AaYuFc7kbMvxRYzpK2uh','12pz8H9mejW1X3AaYuFc7kbMvxRYzpK2uh']);
    });

  });

});

