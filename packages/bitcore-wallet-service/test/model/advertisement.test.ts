'use strict';

import chai from 'chai';
import 'chai/register-should';
import { Advertisement } from '../../src/lib/model/advertisement';

const should = chai.should();

describe('#Advertisement', function() {
  describe('#create', function() {
    it('should create Advertisement', function() {
      const x = Advertisement.create({ title: 'Test Title' });
      should.exist(x);
    });
  });

  describe('#fromObj', function() {
    it('should create Advertisement', function() {
      const x = Advertisement.fromObj({ title: 'Test Title' });
      should.exist(x);
    });
  });

  describe('#toObject', function() {
    it('should convert to object', function() {
      const a = Advertisement.fromObj({ title: 'Test Title' });
      const x = a.toObject();
      should.exist(x);
    });
  });
});