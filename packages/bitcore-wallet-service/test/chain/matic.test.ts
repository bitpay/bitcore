'use strict';

import * as chai from 'chai';
import { ChainService } from '../../src/lib/chain';

const should = chai.should();

describe('Chain MATIC', function() {
  it('should transform addresses to the db', function() {
    const x = { address: '0x01' };
    ChainService.addressToStorageTransform('matic', 'abc', x);
    x.address.should.equal('0x01:abc');
  });

  it('should transform addresses from the db', function() {
    const x = { address: '0x01:dfg' };
    ChainService.addressFromStorageTransform('matic', 'dfg', x);
    x.address.should.equal('0x01');
  });
});

