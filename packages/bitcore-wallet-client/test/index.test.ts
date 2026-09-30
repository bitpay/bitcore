'use strict';

import * as chai from 'chai';
import BWC, * as bwc from '../src/index';

const should = chai.should();

describe('index exports', function () {

  describe('default export', function () {
    it('should export API as the default export', function () {
      should.exist(BWC);
      BWC.should.equal(bwc.API);
    });

    it('default export should be a constructor function', function () {
      BWC.should.be.a('function');
    });
  });


  describe('named class exports', function () {
    it('should export API', function () {
      should.exist(bwc.API);
      bwc.API.should.be.a('function');
    });

    it('should export Credentials', function () {
      should.exist(bwc.Credentials);
      bwc.Credentials.should.be.a('function');
    });

    it('should export Key', function () {
      should.exist(bwc.Key);
      bwc.Key.should.be.a('function');
    });

    it('should export Verifier', function () {
      should.exist(bwc.Verifier);
      bwc.Verifier.should.be.a('function');
    });

    it('should export PayPro', function () {
      should.exist(bwc.PayPro);
      bwc.PayPro.should.be.a('function');
    });

    it('should export PayProV2', function () {
      should.exist(bwc.PayProV2);
      bwc.PayProV2.should.be.a('function');
    });

    it('should export Utils', function () {
      should.exist(bwc.Utils);
      bwc.Utils.should.be.a('function');
    });
  });


  describe('named value exports', function () {
    it('should export Encryption as a non-null object', function () {
      should.exist(bwc.Encryption);
      bwc.Encryption.should.be.an('object');
    });

    it('should export Constants as a non-null object', function () {
      should.exist(bwc.Constants);
      bwc.Constants.should.be.an('object');
    });

    it('should export Errors', function () {
      should.exist(bwc.Errors);
    });
  });


  describe('Errors export', function () {
    it('should be a constructor function', function () {
      bwc.Errors.should.be.a('function');
    });

    it('should expose error sub-types', function () {
      // errorSpec defines named sub-errors like NOT_FOUND, ACCESS_DENIED etc.
      // Verify at least one sub-type exists on the Errors object
      const keys = Object.keys(bwc.Errors);
      keys.length.should.be.greaterThan(0);
    });

    it('should be instantiable and produce an Error-like object', function () {
      const err = new bwc.Errors();
      err.should.be.an.instanceOf(Error);
      err.should.have.property('message');
      err.should.have.property('stack');
    });
  });


  describe('TssKey namespace export', function () {
    it('should export TssKey namespace', function () {
      should.exist(bwc.TssKey);
      bwc.TssKey.should.be.an('object');
    });

    it('should expose TssKey class in namespace', function () {
      should.exist(bwc.TssKey.TssKey);
      bwc.TssKey.TssKey.should.be.a('function');
    });

    it('should expose TssKeyGen class in namespace', function () {
      should.exist(bwc.TssKey.TssKeyGen);
      bwc.TssKey.TssKeyGen.should.be.a('function');
    });
  });


  describe('TssSign namespace export', function () {
    it('should export TssSign namespace', function () {
      should.exist(bwc.TssSign);
      bwc.TssSign.should.be.an('object');
    });

    it('should expose TssSign class in namespace', function () {
      should.exist(bwc.TssSign.TssSign);
      bwc.TssSign.TssSign.should.be.a('function');
    });
  });


  describe('Constants export', function () {
    it('should expose SCRIPT_TYPES', function () {
      bwc.Constants.should.have.property('SCRIPT_TYPES');
    });

    it('should expose DERIVATION_STRATEGIES', function () {
      bwc.Constants.should.have.property('DERIVATION_STRATEGIES');
    });
  });


  describe('Encryption export', function () {
    it('should expose an encryptWithPassword method', function () {
      bwc.Encryption.should.have.property('encryptWithPassword');
      bwc.Encryption.encryptWithPassword.should.be.a('function');
    });

    it('should expose a decryptWithPassword method', function () {
      bwc.Encryption.should.have.property('decryptWithPassword');
      bwc.Encryption.decryptWithPassword.should.be.a('function');
    });

    it('should expose an encryptWithKey method', function () {
      bwc.Encryption.should.have.property('encryptWithKey');
      bwc.Encryption.encryptWithKey.should.be.a('function');
    });

    it('should expose a decryptWithKey method', function () {
      bwc.Encryption.should.have.property('decryptWithKey');
      bwc.Encryption.decryptWithKey.should.be.a('function');
    });
  });

});
