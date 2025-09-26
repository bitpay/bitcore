'use strict';

import chai from 'chai';
import 'chai/register-should';
import { BCHAddressTranslator } from '../src/lib/bchaddresstranslator';

const should = chai.should();

describe('BCH Address translator', function() {

  describe('#getAddressCoin', function() {
    it('should identify btc as coin for 1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', function() {
      BCHAddressTranslator.getAddressCoin('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA').should.equal('legacy');
    });
    it('should identify bch as coin for CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz', function() {
      BCHAddressTranslator.getAddressCoin('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz').should.equal('copay');
    });
    it('should return null for 1L', function() {
      should.not.exist(BCHAddressTranslator.getAddressCoin('1L'));
    });
  });


  describe('#translateAddress', function() {
    it('should translate address from btc to bch', function() {
      const res = BCHAddressTranslator.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'copay');
      res.should.equal('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
    });
    it('should translate address from bch to btc', function() {
      const res = BCHAddressTranslator.translate('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS', 'legacy');
      res.should.equal('36q2G5FMGvJbPgAVEaiyAsFGmpkhPKwk2r');
    });

    it('should keep the address if there is nothing to do (bch)', function() {
      const res = BCHAddressTranslator.translate('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz', 'copay');
      res.should.equal('CcJ4qUfyQ8x5NwhAeCQkrBSWVeXxXghcNz');
    });
    it('should keep the address if there is nothing to do (btc)', function() {
      const res = BCHAddressTranslator.translate('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA', 'legacy');
      should.exist(res);
      res.should.equal('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
    });
    it('should filter out broken addreseses', function() {
      const res = BCHAddressTranslator.translate(['qq2qkh9gs99326ytdg334lvhh999ke9mwgv3w37rl0','pepe', 123,'qq2qkh9gs99326ytdg334lvhh999ke9mwgv3w37rl0', 'false' ], 'copay');
      res.should.deep.equal(['CJHshKVqXnUYRB51EeaXhGDPZ5dxtcDF3z','CJHshKVqXnUYRB51EeaXhGDPZ5dxtcDF3z']);
    });

  });
});

