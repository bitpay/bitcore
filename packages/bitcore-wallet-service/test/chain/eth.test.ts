'use strict';

import chai from 'chai';
import { ChainService } from '../../src/lib/chain';

const should = chai.should();

describe('Chain ETH', function() {
  it('should transform addresses to the db', function() {
    const x = { address: '0x01' };
    ChainService.addressToStorageTransform('eth', 'abc', x);
    x.address.should.equal('0x01:abc');
  });

  it('should transform addresses from the db', function() {
    const x = { address: '0x01:dfg' };
    ChainService.addressFromStorageTransform('eth', 'dfg', x);
    x.address.should.equal('0x01');
  });
});

