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



describe("Schnorr", function() {
    it('instantiation', function() {
        var schnorr = new Schnorr();
        should.exist(schnorr);
      });

    var schnorr = new Schnorr();

    it("Sign/Verify bitcoin-abc-test-spec",  function() {
        schnorr.hashbuf =  Hash.sha256sha256(Buffer.from('Very deterministic message', 'utf-8'));
        schnorr.endianess = 'big';
        schnorr.privkey = new Privkey(BN.fromBuffer('12b004fff7f4b69ef8650e767f18f11ede158148b425660723b9f9a66e61f747','hex'), 'livenet');
        schnorr.privkey2pubkey();
        schnorr.sign();
        schnorr.verify().verified.should.equal(true);
    });

    // Following Test Vectors used from
    // https://github.com/sipa/bips/blob/bip-schnorr/bip-schnorr/test-vectors.csv

    it('Sign/Verify Test 2', function() {
        let hashbuf = (new BN(0)).toBuffer({ size: 32 });
        let privbn = new BN(1);
        // privbn.toBuffer({ size: 32});
        let privkey = new Privkey(privbn);

        let schnorrSig = Schnorr({
            hashbuf: hashbuf,
            endian: "big",
            privkey: privkey,
            hashtype: 65 
        });
        schnorrSig.sign();

        let verified = schnorrSig.verify().verified;
        verified.should.equal(true); 
    });

    it("Sign/Verify 3",  function() {
        schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
        schnorr.endianess = 'big';
        schnorr.privkey = new Privkey(BN.fromBuffer('B7E151628AED2A6ABF7158809CF4F3C762E7160F38B4DA56A784D9045190CFEF','hex'), 'livenet');
        schnorr.privkey2pubkey();
        schnorr.sign();
        schnorr.verify().verified.should.equal(true);
    });
    
    it("Sign/Verify Test 4",  function() {
        var schnorr = new Schnorr();
        schnorr.hashbuf = Buffer.from('5E2D58D8B3BCDF1ABADEC7829054F90DDA9805AAB56C77333024B9D0A508B75C', 'hex');
        schnorr.endianess = 'big';
        schnorr.privkey = new Privkey(BN.fromBuffer('C90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B14E5C9','hex'), 'livenet');
        schnorr.privkey2pubkey();
        schnorr.sign();
        schnorr.verify().verified.should.equal(true);
    });

    it('Verify Test 5', function() {
        schnorr.hashbuf = Buffer.from('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 'hex');
        schnorr.endianess = 'big';
        schnorr.privkey = new Privkey(BN.fromBuffer('0B432B2677937381AEF05BB02A66ECD012773062CF3FA2549E44F58ED2401710','hex'), 'livenet');
        schnorr.privkey2pubkey();
        schnorr.sign();
        schnorr.verify().verified.should.equal(true);
    });

    it("Verify Test 6 should fail",  function() {
        schnorr.hashbuf = Buffer.from('4DF3C3F68FCC83B27E9D42C90431A72499F17875C81A599B566C9889B9696703', 'hex');
        schnorr.endianess = 'big';
        schnorr.pubkey = new Pubkey("02D69C3509BB99E412E68B0FE8544E72837DFA30746D8BE2AA65975F29D22DC7B9", { compressed: true});
        schnorr.sig = Signature.fromString("00000000000000000000003B78CE563F89A0ED9414F5AA28AD0D96D6795F9C63EE374AC7FAE927D334CCB190F6FB8FD27A2DDC639CCEE46D43F113A4035A2C7F");
        schnorr.verify().verified.should.equal(false, "Should fail");
    });

    it("Verify Test 7, public key not on the curve",  function() {
        (function() {
            return new Pubkey("02EEFDEA4CDB677750A420FEE807EACF21EB9898AE79B9768766E4FAA04A2D4A34").should.throw("Invalid X");
        });
    });

    it("Verify Test 8, has_square_y(R) is false",  function() {
        schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
        schnorr.endianess = 'big';
        schnorr.pubkey = new Pubkey("02DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659", { compressed: true});
        schnorr.sig = Signature.fromString("F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9935554D1AA5F0374E5CDAACB3925035C7C169B27C4426DF0A6B19AF3BAEAB138");
        schnorr.verify().verified.should.equal(false, "Should fail");
    });

    it("Verify Test 9, negated message",  function() {
        schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
        schnorr.endianess = 'big';
        schnorr.pubkey = new Pubkey("02DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659", { compressed: true});
        schnorr.sig = Signature.fromString("10AC49A6A2EBF604189C5F40FC75AF2D42D77DE9A2782709B1EB4EAF1CFE9108D7003B703A3499D5E29529D39BA040A44955127140F81A8A89A96F992AC0FE79");
        schnorr.verify().verified.should.equal(false, "Should fail");
    });

    it("Verify Test 10, sG - eP is infinite. Test fails in single verification if has_square_y(inf) is defined as true and x(inf) as 0",  function() {
        schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
        schnorr.endianess = 'big';
        schnorr.pubkey = new Pubkey("02DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659", { compressed: true});
        schnorr.sig = Signature.fromString("000000000000000000000000000000000000000000000000000000000000000099D2F0EBC2996808208633CD9926BF7EC3DAB73DAAD36E85B3040A698E6D1CE0");
        schnorr.verify().verified.should.equal(false, "Should fail");
    });

    it("Verify Test 11, sig[0:32] is not an X coordinate on the curve",  function() {
        schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
        schnorr.endianess = 'big';
        schnorr.pubkey = new Pubkey("02DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659", { compressed: true});
        schnorr.sig = Signature.fromString("4A298DACAE57395A15D0795DDBFD1DCB564DA82B0F269BC70A74F8220429BA1D4160BCFC3F466ECB8FACD19ADE57D8699D74E7207D78C6AEDC3799B52A8E0598");
        schnorr.verify().verified.should.equal(false, "Should fail");
    });

    it("Verify Test 12, sig[0:32] is equal to field size",  function() {
        schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
        schnorr.endianess = 'big';
        schnorr.pubkey = new Pubkey("02DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659", { compressed: true});
        schnorr.sig = Signature.fromString("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F4160BCFC3F466ECB8FACD19ADE57D8699D74E7207D78C6AEDC3799B52A8E0598");
        schnorr.verify().verified.should.equal(false, "Should fail");
    });

    it("Verify Test 13, sig[32:64] is equal to curve order",  function() {
        schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
        schnorr.endianess = 'big';
        schnorr.pubkey = new Pubkey("02DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA659", { compressed: true});
        schnorr.sig = Signature.fromString("667C2F778E0616E611BD0C14B8A600C5884551701A949EF0EBFD72D452D64E84FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
        schnorr.verify().verified.should.equal(false, "Should fail");
    });

    it("Verify Test 14, public key is not a valid X coordinate because it exceeds the field size",  function() {
        schnorr.hashbuf = Buffer.from('243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89', 'hex');
        schnorr.endianess = 'big';
        schnorr.pubkey = new Pubkey("02FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC30", { compressed: true});
        schnorr.sig = Signature.fromString("667C2F778E0616E611BD0C14B8A600C5884551701A949EF0EBFD72D452D64E844160BCFC3F466ECB8FACD19ADE57D8699D74E7207D78C6AEDC3799B52A8E0598");
        schnorr.verify().verified.should.equal(false, "Should fail");
    });
});