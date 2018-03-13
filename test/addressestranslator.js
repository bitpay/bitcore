
var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var assert = require('assert');
var should = chai.should;

var AddressTranslator = require('../lib/addresstranslator');

describe('#AddressTranslator', function() {

  it('should translate address from legacy to cashaddr', function() {
    var res = AddressTranslator.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'cashaddr');
    assert( res == 'qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gms8s0u59');
  });


  it('should translate address from copay to cashaddr', function() {
    var res = AddressTranslator.translate('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS', 'cashaddr');
    assert( res == 'pqu9c0xe7g0ngz9hzpky64nva9790m64esxxjmcv2k');
  });

  it('should translate address from cashaddr to copay', function() {
    var res = AddressTranslator.translate('pqu9c0xe7g0ngz9hzpky64nva9790m64esxxjmcv2k', 'copay');
    assert( res == 'HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS');
  });


  it('should keep addresses if not translation needed from cashaddr to copay', function() {
    var res = AddressTranslator.translate('pqu9c0xe7g0ngz9hzpky64nva9790m64esxxjmcv2k', 'cashaddr');
    assert( res == 'pqu9c0xe7g0ngz9hzpky64nva9790m64esxxjmcv2k');
  });


  it('should translate address from legacy to cashaddr (testnet)', function() {
    var res = AddressTranslator.translate('mnE5ERQ3MKrgAVSLQtBifyjAPE8t6aRfLL', 'cashaddr');
    assert( res == 'qpye0xdyrukzs548zjag5vas8s8f956g8svs329zm4');
  });



  it('should translate address from cashaddr to legacy (testnet)', function() {
    var res = AddressTranslator.translate('qpye0xdyrukzs548zjag5vas8s8f956g8svs329zm4', 'legacy');
    assert( res == 'mnE5ERQ3MKrgAVSLQtBifyjAPE8t6aRfLL');
  });



  it.skip('should translate address from bch to btc', function() {
    var res = AddressTranslator.translateInput('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS');
    assert(res=='36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
  });

  it.skip('should keep the address if there is nothing to do (bch)', function() {
    var res = AddressTranslator.translate('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz', 'bch');
    assert(res=='qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gms8s0u59');
  });
  it.skip('should keep the address if there is nothing to do (btc)', function() {
    var res = AddressTranslator.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'btc');
    assert(res=='1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
  });
  it.skip('should support 3 params NOK', function() {

    var a;
    try {
      var res = AddressTranslator.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'btc', 'bch');
    } catch (e) {
      a=e.toString();
      assert(a.match(/Address has mismatched network type/));
    };
  });
  it.skip('should support 3 params OK', function() {
    var res = AddressTranslator.translate('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS', 'btc', 'bch');
    assert(res=='36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
  });

  it.skip('should work with arrays also', function() {
    var res = AddressTranslator.translateOutput(['1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', '37YHiaQnMjy73GS1UpiE8p2Ju6MyrrDw3J', '1DuPdCpGzVX73kBYaAbu5XDNDgE2Lza5Ed']);
    assert(res[0] == 'qrvcdmgpk73zyfd8pmdl9wnuld36zh9n4gms8s0u59');
    assert(res[1] == 'ppqz5v08kssnuupe0ckqtw4ss3qt460fcqugqzq2me');
    assert(res[2] == 'qzxc5pnsfs8pmgfprhzc4l4vzf3zxz8p85nc6kfh8l');
  });
 

});


