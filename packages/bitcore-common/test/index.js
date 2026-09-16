/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Curve, Point, Utils } = require('../');
const { expect } = require('chai');

describe('bitcore-common', function() {

  describe('BN', function() {
    it('should export a BN class', function() {
      expect(BN).to.exist;
    });
  });

  describe('Curve', function() {
    it('should export a Curve object', function() {
      expect(Curve).to.exist;
    });
  });

  describe('Point', function() {
    it('should export a Point class', function() {
      expect(Point).to.exist;
    });
  });

  describe('Utils', function() {
    it('should export a Utils object', function() {
      expect(Utils).to.exist;
    });
  });

});
