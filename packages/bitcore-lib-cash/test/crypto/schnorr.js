'use strict';

var Schnorr = require('../../lib/crypto/schnorr');
var Hash = require('../../lib/crypto/hash');
var Privkey = require('../../lib/privatekey');
var Pubkey = require('../../lib/publickey');
var Signature = require('../../lib/crypto/signature');
var BN = require('../../lib/crypto/bn');
var point = require('../../lib/crypto/point');
var should = require('chai').should();
var vectors = require('../data/ecdsa');


// Test Vectors used from
// https://github.com/sipa/bips/blob/bip-schnorr/bip-schnorr/test-vectors.csv

describe.only("Schnorr", function() {
    it('instantiation', function() {
        var schnorr = new Schnorr();
        should.exist(schnorr);
      });

    var schnorr = new Schnorr();
    schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
    schnorr.endianess = 'big';
    schnorr.privkey = new Privkey(BN.fromBuffer('B7E151628AED2A6ABF7158809CF4F3C762E7160F38B4DA56A784D9045190CFEF','hex'), 'livenet');

    it("Sign Test",  function() {
        schnorr.hashbuf = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
        schnorr.endianess = 'big';
        let n = point.getN();
        let privateKey = new Privkey(n.sub(BN.fromBuffer('0000000000000000000000000000000000000000000000000000000000000001','hex')), 'livenet');
        //schnorr.privkey = new Privkey(BN.fromBuffer('0000000000000000000000000000000000000000000000000000000000000001','hex'), 'livenet');
        schnorr.privkey = privateKey;
        schnorr.privkey2pubkey();
        schnorr.sign();
        console.log(schnorr);
    });

    it("Signature Test",  function() {
        schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
        schnorr.endianess = 'big';
        schnorr.privkey = new Privkey(BN.fromBuffer('B7E151628AED2A6ABF7158809CF4F3C762E7160F38B4DA56A784D9045190CFEF','hex'), 'livenet');
        schnorr.privkey2pubkey();
        schnorr.sign();
        console.log(schnorr);

        schnorr.sig.r.toBuffer().should.equal('667c2f778e0616e611bd0c14b8a600c5884551701a949ef0ebfd72d452d64e84');
    });

    it("Sign Test",  function() {
        schnorr.hashbuf = Buffer.from('5E2D58D8B3BCDF1ABADEC7829054F90DDA9805AAB56C77333024B9D0A508B75C', 'hex');
        schnorr.endianess = 'big';
        schnorr.privkey = new Privkey(BN.fromBuffer('C90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B14E5C9','hex'), 'livenet');
        schnorr.privkey2pubkey();
        schnorr.sign();
        console.log(schnorr);
    });

    it("Sign Test",  function() {
        schnorr.hashbuf = Buffer.from('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 'hex');
        schnorr.endianess = 'big';
        schnorr.privkey = new Privkey(BN.fromBuffer('0B432B2677937381AEF05BB02A66ECD012773062CF3FA2549E44F58ED2401710','hex'), 'livenet');
        schnorr.privkey2pubkey();
        let sig = schnorr.sign();
        console.log(schnorr);
    });



});