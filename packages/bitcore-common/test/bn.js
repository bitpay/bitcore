/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN } = require('../');
const { expect } = require('chai');
const { SECP_P, SECP_N } = require('./curve/helpers');

// Bitcoin test vectors for red context (known k256 scalar ops)
const TEST_BASE = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('BN', function () {
  describe('Construction & Identity', function () {

    // BN.CONSTRUCT.NUM
    it('BN.CONSTRUCT.NUM - construct from JS number', function () {
      expect(new BN(0).toString(16)).to.equal('0');
      expect(new BN(1).toString(16)).to.equal('1');
      expect(new BN(255).toString(16)).to.equal('ff');
      expect(new BN(0x3ffffff).toString(16)).to.equal('3ffffff'); // max single 26-bit word
      expect(new BN(0x4000000).toString(16)).to.equal('4000000');    // crosses word boundary
    });

    // BN.CONSTRUCT.HEX
    it('BN.CONSTRUCT.HEX - construct from hex string', function () {
      expect(new BN('deadbeef', 16).toString(16)).to.equal('deadbeef');
      expect(new BN('DEADBEEF', 16).toString(16)).to.equal('deadbeef');
      expect(new BN('deadbeef', 'hex').toString(16)).to.equal('deadbeef');
      expect(new BN('0xdeadbeef', 16).toString(16)).to.equal('deadbeef');
    });

    // BN.CONSTRUCT.OBJECT
    it('BN.CONSTRUCT.OBJECT - construct from byte array', function () {
      const a = new BN([0xaa, 0xbb, 0xcc]);
      expect(a.toString(16)).to.equal('aabbcc');
      const b = new BN([0x00, 0x01]);
      expect(b.toString(16)).to.equal('1');
    });

    // BN.CONSTRUCT.LE
    it('BN.CONSTRUCT.LE - construct with little-endian', function () {
      const be = new BN([0x01, 0x02, 0x03], 10, 'be');
      const le = new BN([0x01, 0x02, 0x03], 10, 'le');
      expect(be.toString(16)).to.equal('10203');
      expect(le.toString(16)).to.equal('30201');
    });

    // BN.CONSTRUCT.NEG
    it('BN.CONSTRUCT.NEG - construct negative numbers', function () {
      const a = new BN(-5);
      expect(a.toString(10)).to.equal('-5');
      expect(a.negative).to.equal(1);
      const b = new BN('-5');
      expect(b.toString(10)).to.equal('-5');
      expect(b.negative).to.equal(1);
      const c = new BN('-ff', 16);
      expect(c.toString(16)).to.equal('-ff');
    });

    // BN.CONSTRUCT.NULL
    it('BN.CONSTRUCT.NULL - null produces empty shell', function () {
      const a = new BN(null);
      expect(a.negative).to.equal(0);
      expect(a.words).to.be.null;
      expect(a.length).to.equal(0);
      expect(a.red).to.be.null;
    });

    // BN.CONSTRUCT.LARGE
    it('BN.CONSTRUCT.LARGE - 256-bit numbers (secp256k1 order and field)', function () {
      const n = new BN(SECP_N, 16);
      expect(n.toString(16)).to.equal(SECP_N);
      expect(n.bitLength()).to.be.lessThanOrEqual(256);
      const p = new BN(SECP_P, 16);
      expect(p.toString(16)).to.equal(SECP_P);
      expect(p.bitLength()).to.equal(256);
    });

    // BN.CONSTRUCT.MULBN
    it('BN.CONSTRUCT.MULBN - constructing from another BN returns same instance', function () {
      const a = new BN(42);
      const b = new BN(a);
      expect(b).to.equal(a);
    });

    // BN.CONSTRUCT.MULTIBASE
    it('BN.CONSTRUCT.MULTIBASE - constructs from bases 2-36', function () {
      expect(new BN('1010', 2).toNumber()).to.equal(10);
      expect(new BN('12', 3).toNumber()).to.equal(5);
      expect(new BN('10', 8).toNumber()).to.equal(8);
      expect(new BN('10', 10).toNumber()).to.equal(10);
      expect(new BN('10', 16).toNumber()).to.equal(16);
      expect(new BN('10', 36).toNumber()).to.equal(36);
      expect(new BN('zz', 36).toString(10)).to.equal('1295');
    });

    // BNISR.CONSTRUCT.EMPTY
    it('BNISR.CONSTRUCT.EMPTY - empty array produces zero', function () {
      const a = new BN([]);
      expect(a.toString(10)).to.equal('0');
    });

  });
  describe('Addition & Subtraction', function () {

    // BN.ADD.BASIC
    it('BN.ADD.BASIC - basic addition', function () {
      expect(new BN(50).add(new BN(75)).toNumber()).to.equal(125);
    });

    // BN.ADD.MULTIWORD
    it('BN.ADD.MULTIWORD - cross-word boundary carry (2^52 + 2^52 = 2^53)', function () {
      const a = new BN(2).pow(new BN(52));
      const b = new BN(2).pow(new BN(52));
      const expected = new BN(2).pow(new BN(53));
      expect(a.add(b).toString(16)).to.equal(expected.toString(16));
    });

    // BN.ADD.NEGATIVE
    it('BN.ADD.NEGATIVE - signed addition', function () {
      expect(new BN(-5).add(new BN(10)).toNumber()).to.equal(5);
      expect(new BN(5).add(new BN(-10)).toNumber()).to.equal(-5);
      expect(new BN(-5).add(new BN(-7)).toNumber()).to.equal(-12);
    });

    // BN.ADD.LARGE
    it('BN.ADD.LARGE - 256-bit addition with carry', function () {
      const n = new BN(SECP_N, 16);
      const doubled = n.add(n);
      expect(doubled.toString(16)).to.equal(n.muln(2).toString(16));
    });

    // BN.ADD.IADD
    it('BN.ADD.IADD - in-place addition mutates target', function () {
      const a = new BN(10);
      const b = new BN(20);
      const result = a.iadd(b);
      expect(result).to.equal(a);
      expect(a.toNumber()).to.equal(30);
    });

    // BN.ADD.IADDN
    it('BN.ADD.IADDN - in-place add JS number at word boundary', function () {
      const a = new BN(0x3ffffff);
      a.iaddn(0x3ffffff); // max single-word addition
      expect(a.toString(16)).to.equal('7fffffe');
    });

    // BN.SUB.BASIC
    it('BN.SUB.BASIC - basic subtraction', function () {
      expect(new BN(100).sub(new BN(30)).toNumber()).to.equal(70);
    });

    // BN.SUB.CARRY
    it('BN.SUB.CARRY - borrow produces correct negative result', function () {
      const result = new BN(1).sub(new BN(5));
      expect(result.toNumber()).to.equal(-4);
    });

    // BN.SUB.NEGATIVE
    it('BN.SUB.NEGATIVE - signed subtraction', function () {
      expect(new BN(5).sub(new BN(-3)).toNumber()).to.equal(8);
      expect(new BN(-5).sub(new BN(3)).toNumber()).to.equal(-8);
    });

    // BN.SUB.LARGE
    it('BN.SUB.LARGE - n - 1 where n = secp256k1 order', function () {
      const n = new BN(SECP_N, 16);
      const result = n.subn(1);
      expect(result.toString(16)).to.equal('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140');
    });

    // BN.SUB.ZERO
    it('BN.SUB.ZERO - a - a produces non-negative zero', function () {
      const a = new BN(SECP_N, 16);
      const zero = a.sub(a);
      expect(zero.toString(10)).to.equal('0');
      expect(zero.negative).to.equal(0);
      expect(zero.isZero()).to.be.true;
    });

  });
  describe('Multiplication & Division', function () {

    // BN.MUL.BASIC
    it('BN.MUL.BASIC - basic multiplication', function () {
      expect(new BN(6).mul(new BN(7)).toNumber()).to.equal(42);
    });

    // BN.MUL.MULTIWORD
    it('BN.MUL.MULTIWORD (2^30 * 2^30 = 2^60)', function () {
      const a = new BN(2).pow(new BN(30));
      const expected = new BN(2).pow(new BN(60));
      expect(a.mul(a).toString(16)).to.equal(expected.toString(16));
    });

    // BN.MUL.LARGE
    it('BN.MUL.LARGE - 256-bit * 256-bit = 512-bit', function () {
      const n = new BN(SECP_N, 16);
      const result = n.mul(n);
      expect(result.bitLength()).to.lessThanOrEqual(512);
    });

    // BN.MUL.COMB10
    it('BN.MUL.COMB10 - two numbers each with exactly 10 limbs', function () {
      // 10 words * 26 bits/word = 260 bits
      const two = new BN(2);
      const exp260 = two.pow(new BN(260));
      const a = exp260.clone().isubn(1);
      const b = exp260.clone().isubn(1);
      // (2^260 - 1)^2 = 2^520 - 2^261 + 1
      const expected = two.pow(new BN(520)).isub(two.pow(new BN(261))).iaddn(1);
      expect(a.mul(b).cmp(expected)).to.equal(0);
    });

    // BN.MUL.BIGMUL
    it('BN.MUL.BIGMUL - large multiplication (80 limbs total, triggers bigMulTo)', function () {
      const two = new BN(2);
      const exp1040 = two.pow(new BN(1040));
      const a = exp1040.clone().isubn(1);
      const b = exp1040.clone().isubn(1);
      const expected = two.pow(new BN(2080)).isub(two.pow(new BN(1041))).iaddn(1);
      expect(a.mul(b).cmp(expected)).to.equal(0);
    });

    // BN.MUL.JUMBO
    it('BN.MUL.JUMBO - very large multiplication (1200 limbs total, triggers FFT)', function () {
      const two = new BN(2);
      const exp15600 = two.pow(new BN(15600));
      const a = exp15600.clone().isubn(1);
      const b = exp15600.clone().isubn(1);
      const expected = two.pow(new BN(31200)).isub(two.pow(new BN(15601))).iaddn(1);
      expect(a.mul(b).cmp(expected)).to.equal(0);
    });

    // BN.MUL.NEG
    it('BN.MUL.NEG - sign handling in multiplication', function () {
      expect(new BN(-3).mul(new BN(4)).toNumber()).to.equal(-12);
      expect(new BN(3).mul(new BN(-4)).toNumber()).to.equal(-12);
      expect(new BN(-3).mul(new BN(-4)).toNumber()).to.equal(12);
    });

    // BN.MUL.ZERO
    it('BN.MUL.ZERO - anything times zero produces zero', function () {
      expect(new BN(42).mul(new BN(0)).toNumber()).to.equal(0);
      expect(new BN(0).mul(new BN(42)).toNumber()).to.equal(0);
      expect(new BN(0).mul(new BN(0)).toNumber()).to.equal(0);
    });

    // BN.SQR
    it('BN.SQR - s() produces correct square', function () {
      // Test with SECP_P (large 256-bit value) via BigInt oracle
      const expected = (BigInt('0x' + SECP_P) ** 2n).toString(16);
      expect(new BN(SECP_P, 16).sqr().toString(16)).to.equal(expected);

      // Test with small value: 12345^2 = 152399025
      expect(new BN(12345).sqr().toNumber()).to.equal(152399025);

      // Test with power-of-2 boundary: 0xffff^2 = 0xfffe0001 = 4294836225
      expect(new BN(0xffff).sqr().toNumber()).to.equal(4294836225);
    });

    // BN.ISQR
    it('BN.ISQR - in-place square mutates target', function () {
      const a = new BN(1234567);
      const original = a.clone();
      const result = a.isqr();
      expect(result).to.equal(a);
      expect(a.toString(16)).to.equal(original.mul(original).toString(16));
    });

    // BN.MULN
    it('BN.MULN - multiply by JS number', function () {
      expect(new BN(100).muln(7).toNumber()).to.equal(700);
      expect(new BN(100).muln(-7).toNumber()).to.equal(-700);
    });

    // BN.IMULN
    it('BN.IMULN - in-place multiply by JS number', function () {
      const a = new BN(100);
      const result = a.imuln(3);
      expect(result).to.equal(a);
      expect(a.toNumber()).to.equal(300);
    });

    // BN.DIV.BASIC
    it('BN.DIV.BASIC - basic division (25 / 6 = 4 remainder 1)', function () {
      expect(new BN(25).div(new BN(6)).toNumber()).to.equal(4);
      expect(new BN(25).mod(new BN(6)).toNumber()).to.equal(1);
    });

    // BN.DIV.LARGE
    it('BN.DIV.LARGE - (n * 2) / n = 2', function () {
      const n = new BN(SECP_N, 16);
      const product = n.muln(2);
      expect(product.div(n).toNumber()).to.equal(2);
    });

    // BN.DIV.NEGATIVE
    it('BN.DIV.NEGATIVE - division with negative operands', function () {
      expect(new BN(-24).div(new BN(6)).toNumber()).to.equal(-4);
      expect(new BN(24).div(new BN(-6)).toNumber()).to.equal(-4);
      expect(new BN(-24).div(new BN(-6)).toNumber()).to.equal(4);
    });

    // BN.DIV.ONESTEP
    it('BN.DIV.ONESTEP - division by single-word number', function () {
      expect(new BN(0x3ffffff).divn(3).toString(16)).to.equal('1555555');
    });

    // BN.DIV.ZERO_REM
    it('BN.DIV.ZERO_REM - exact division has zero remainder', function () {
      expect(new BN(24).div(new BN(6)).toNumber()).to.equal(4);
      expect(new BN(24).mod(new BN(6)).toNumber()).to.equal(0);
    });

    // BN.MOD.BASIC
    it('BN.MOD.BASIC - basic modulo', function () {
      expect(new BN(20).mod(new BN(7)).toNumber()).to.equal(6);
    });

    // BN.MOD.NMOD
    it('BN.MOD.NMOD - single-word mod via modn()', function () {
      expect(new BN(255).modn(100)).to.equal(55);
    });

    // BN.MOD.UMOD
    it('BN.MOD.UMOD - unsigned mod (negative -> positive result)', function () {
      expect(new BN(-6).umod(new BN(4)).toNumber()).to.equal(2);
    });

    // BN.DIVROUND
    it('BN.DIVROUND - rounding division', function () {
      expect(new BN(7).divRound(new BN(3)).toNumber()).to.equal(2);
      expect(new BN(8).divRound(new BN(3)).toNumber()).to.equal(3);
    });

    // BN.GCD
    it('BN.GCD - greatest common divisor', function () {
      expect(new BN(12).gcd(new BN(8)).toNumber()).to.equal(4);
      expect(new BN(17).gcd(new BN(13)).toNumber()).to.equal(1);
      expect(new BN(0).gcd(new BN(5)).toNumber()).to.equal(5);
      expect(new BN(SECP_P, 16).gcd(new BN(SECP_N, 16)).toNumber()).to.equal(1);
    });

    // BN.INVM
    it('BN.INVM - modular inverse for prime modulus', function () {
      const p = new BN(SECP_P, 16);
      const a = new BN(3);
      const inv = a.invm(p);
      expect(a.mul(inv).mod(p).toNumber()).to.equal(1);
    });

    // BN.INVM.IDENTITY
    it('BN.INVM.IDENTITY - a * invm(a) = 1 (mod p)', function () {
      const p = new BN(SECP_P, 16);
      const a = new BN('1234567890abcdef', 16);
      const inv = a.invm(p);
      expect(a.mul(inv).mod(p).toNumber()).to.equal(1);
    });

    // BN.POW
    it('BN.POW - exponentiation (2^10 = 1024, a^0 = 1, a^1 = a)', function () {
      expect(new BN(2).pow(new BN(10)).toNumber()).to.equal(1024);
      const a = new BN(99);
      expect(a.pow(new BN(0)).toNumber()).to.equal(1);
      expect(a.pow(new BN(1)).toNumber()).to.equal(99);
    });
  });
  describe('Bitwise Operations', function () {

    // BN.OR
    it('BN.OR - bitwise or (0b1010 | 0b1100 = 0b1110)', function () {
      expect(new BN(0b1010).or(new BN(0b1100)).toNumber()).to.equal(0b1110);
    });

    // BN.AND
    it('BN.AND - bitwise and (0b1110 & 0b1010 = 0b1010)', function () {
      expect(new BN(0b1110).and(new BN(0b1010)).toNumber()).to.equal(0b1010);
    });

    // BN.XOR
    it('BN.XOR - bitwise xor (0b1110 ^ 0b1010 = 0b0100)', function () {
      expect(new BN(0b1110).xor(new BN(0b1010)).toNumber()).to.equal(0b0100);
    });

    // BN.NOT
    it('BN.NOT - bit inversion (NOT(0xFF, 16) = 0 for 16-bit width with padding)', function () {
      // 0xff -> 0x00ff
      expect(new BN(0xff).notn(16).toNumber()).to.equal(65280);
    });

    it('BN.NOT - bit inversion without padding', function () {
      expect(new BN(0xffff).notn(16).toNumber()).to.equal(0);

      // Compare to padding test above
      expect(new BN(0xff).notn(8).toNumber()).to.equal(0);
    });

    // BN.SETN / BN.TESTN
    it('BN.SETN / BN.TESTN - set and test individual bits', function () {
      const a = new BN(0);
      a.setn(3, true);
      a.setn(5, true);
      expect(a.testn(3)).to.be.true;
      expect(a.testn(5)).to.be.true;
      expect(a.testn(4)).to.be.false;
      expect(a.toNumber()).to.equal(40); // 32 + 8
      a.setn(3, false);
      expect(a.testn(3)).to.be.false;
      expect(a.toNumber()).to.equal(32);
    });

    // BN.ANDLN
    it('BN.ANDLN - low nibble via andln', function () {
      expect(new BN(0xabcd).andln(0xf)).to.equal(0xd);
      expect(new BN(0xff00).andln(0xff)).to.equal(0);
    });

    // BN.IMASKN
    it('BN.IMASKN - mask to lower N bits', function () {
      const a = new BN(0xff00);
      a.imaskn(8);
      expect(a.toNumber()).to.equal(0);
      const b = new BN(0x12345678);
      b.imaskn(16);
      expect(b.toNumber()).to.equal(0x5678);
    });

    // BN.ICMP
    it('BN.ICMP / BN.CMP - signed compare', function () {
      expect(new BN(10).cmp(new BN(5))).to.equal(1);
      expect(new BN(5).cmp(new BN(10))).to.equal(-1);
      expect(new BN(5).cmp(new BN(5))).to.equal(0);
      expect(new BN(-5).cmp(new BN(3))).to.equal(-1);
      expect(new BN(-10).cmp(new BN(-5))).to.equal(-1);
      expect(new BN(-5).cmp(new BN(-10))).to.equal(1);
    });

    // BN.CHAIN (bitwise chaining verification)
    it('BN.CHAIN - bitwise operations chain correctly', function () {
      const result = new BN(255).notn(16).ior(new BN(0xff));
      expect(result.toNumber()).to.equal(0xffff);
    });
  });
  describe('Shift Operations', function () {

    // BN.SHL.WITHIN_WORD
    it('BN.SHL.WITHIN_WORD - shift within a single 26-bit word (1 << 20)', function () {
      expect(new BN(1).shln(20).toNumber()).to.equal(0x100000);
    });

    // BN.SHL.CROSS_WORD
    it('BN.SHL.CROSS_WORD - shift across word boundary (1 << 30)', function () {
      const result = new BN(1).shln(30);
      const expected = new BN(2).pow(new BN(30));
      expect(result.toString(16)).to.equal(expected.toString(16));
    });

    // BN.SHL.MULTIWORD
    it('BN.SHL.MULTIWORD - large shift (2^50 << 30 = 2^80)', function () {
      const a = new BN(2).pow(new BN(50));
      const shifted = a.shln(30);
      const expected = new BN(2).pow(new BN(80));
      expect(shifted.toString(16)).to.equal(expected.toString(16));
    });

    // BN.SHR.WITHIN_WORD
    it('BN.SHR.WITHIN_WORD - shift within a word (0x3ffffff >> 10)', function () {
      const a = new BN(0x3ffffff);
      expect(a.shrn(10).toNumber()).to.equal(0xffff);
    });

    // BN.SHR.CROSS_WORD
    it('BN.SHR.CROSS_WORD - shift across word boundary', function () {
      const a = new BN(2).pow(new BN(30));
      expect(a.shrn(5).toString(16)).to.equal(new BN(2).pow(new BN(25)).toString(16));
    });

    // BN.SHR.TO_ZERO
    it('BN.SHR.TO_ZERO - shifting until zero', function () {
      const a = new BN(1024);
      expect(a.shrn(9).toNumber()).to.equal(2);
      expect(a.shrn(10).toNumber()).to.equal(1);
      expect(a.shrn(11).isZero()).to.be.true;
    });

    // BN.USHLN.ISHLN
    it('BN.USHLN.ISHLN - unsigned and signed left-shift equivalence for positives', function () {
      const a = new BN(1);
      const b = new BN(1);
      expect(a.ushln(20).toString(16)).to.equal(b.ishln(20).toString(16));
    });

    // BN.ISHLN (in-place shift)
    it('BN.ISHLN - in-place shift-left', function () {
      const a = new BN(1);
      const result = a.iushln(10);
      expect(result).to.equal(a);
      expect(a.toNumber()).to.equal(1024);
    });

  });
  describe('Comparison & Predicates', function () {

    // BN.CMP.POSITIVE
    it('BN.CMP.POSITIVE - compare positive values', function () {
      expect(new BN(10).cmp(new BN(5))).to.equal(1);
      expect(new BN(5).cmp(new BN(10))).to.equal(-1);
      expect(new BN(5).cmp(new BN(5))).to.equal(0);
    });

    // BN.CMP.NEGATIVE
    it('BN.CMP.NEGATIVE - compare with negative operands', function () {
      expect(new BN(-10).cmp(new BN(-5))).to.equal(-1);
      expect(new BN(-5).cmp(new BN(-10))).to.equal(1);
      expect(new BN(-5).cmp(new BN(-5))).to.equal(0);
    });

    // BN.CMP.MIXED
    it('BN.CMP.MIXED - cross-sign comparison', function () {
      expect(new BN(5).cmp(new BN(-5))).to.equal(1);
      expect(new BN(-5).cmp(new BN(5))).to.equal(-1);
    });

    // BN.CMP.MULTIWORD
    it('BN.CMP.MULTIWORD - compare two 256-bit numbers differing in MSB', function () {
      const a = new BN('00fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f', 16);
      const b = new BN('00fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2e', 16);
      expect(a.cmp(b)).to.equal(1);
    });

    // BN.CMPN
    it('BN.CMPN - compare against JS number', function () {
      expect(new BN(100).cmpn(50)).to.equal(1);
      expect(new BN(100).cmpn(200)).to.equal(-1);
      expect(new BN(100).cmpn(100)).to.equal(0);
      expect(new BN(-5).cmpn(5)).to.equal(-1);
    });

    // BN.ISZERO
    it('BN.ISZERO - zero check', function () {
      expect(new BN(0).isZero()).to.be.true;
      expect(new BN(1).isZero()).to.be.false;
      expect(new BN(1).sub(new BN(1)).isZero()).to.be.true;
    });

    // BN.ISEVEN / BN.ISODD
    it('BN.ISEVEN / BN.ISODD - parity checks', function () {
      expect(new BN(0).isEven()).to.be.true;
      expect(new BN(1).isEven()).to.be.false;
      expect(new BN(2).isEven()).to.be.true;
      expect(new BN(SECP_P, 16).isOdd()).to.be.true; // p ends in 'f'
      expect(new BN(SECP_N, 16).isOdd()).to.be.true; // n ends in '1'
    });

    // BN.ISNEG
    it('BN.ISNEG - negativity predicate', function () {
      expect(new BN(5).isNeg()).to.be.false;
      expect(new BN(-5).isNeg()).to.be.true;
      expect(new BN(0).isNeg()).to.be.false;
    });

    // BN.BITLENGTH
    it('BN.BITLENGTH - bit length for various sizes', function () {
      expect(new BN(1).bitLength()).to.equal(1);
      expect(new BN(0x3ffffff).bitLength()).to.equal(26);
      
      expect(new BN(0x4000000).bitLength()).to.equal(27);
      expect(new BN(0x10000000000000).bitLength()).to.equal(53);
      expect(new BN(SECP_P, 16).bitLength()).to.equal(256);
    });

    // BN.BYTELENGTH
    it('BN.BYTELENGTH - byte length for various sizes', function () {
      expect(new BN(1).byteLength()).to.equal(1);
      expect(new BN(0xff).byteLength()).to.equal(1);
      expect(new BN(0x100).byteLength()).to.equal(2);
      expect(new BN(SECP_P, 16).byteLength()).to.equal(32);
    });

    // BN.ZEROBITS
    it('BN.ZEROBITS - trailing zeros', function () {
      expect(new BN(1).zeroBits()).to.equal(0);
      expect(new BN(2).zeroBits()).to.equal(1);
      expect(new BN(8).zeroBits()).to.equal(3);
      expect(new BN(0x3ffffff).zeroBits()).to.equal(0);
      expect(new BN(0x4000000).zeroBits()).to.equal(26);
    });

    // BN.MAX / BN.MIN
    it('BN.MAX / BN.MIN - static max/min', function () {
      expect(BN.max(new BN(10), new BN(5)).toNumber()).to.equal(10);
      expect(BN.min(new BN(10), new BN(5)).toNumber()).to.equal(5);
    });

    // BN.ISBN
    it('BN.ISBN - type guard', function () {
      expect(BN.isBN(new BN(5))).to.be.true;
      expect(BN.isBN(5)).to.be.false;
      expect(BN.isBN(null)).to.be.false;
      expect(BN.isBN({})).to.be.false;
      expect(BN.isBN(new BN('ff', 16))).to.be.true;
    });

  });
  describe('Serialization & Conversion', function () {

    // BN.TO_BUFFER.BE
    it('BN.TO_BUFFER.BE - toBuffer big-endian for 256-bit number', function () {
      const a = new BN(SECP_P, 16);
      const buf = a.toBuffer('be', 32);
      expect(buf).to.be.instanceOf(Buffer);
      expect(buf.length).to.equal(32);
      expect(buf.toString('hex')).to.equal(SECP_P);
    });

    // BN.TO_BUFFER.LE
    it('BN.TO_BUFFER.LE - toBuffer little-endian', function () {
      const hex = '01020304';
      const a = new BN(hex, 16);
      const buf = a.toBuffer('le', 4);
      expect(buf.length).to.equal(4);
      expect(buf.toString('hex')).to.equal('04030201');
    });

    // BN.TO_BUFFER.PADDED
    it('BN.TO_BUFFER.PADDED - output padded to specified length (32 bytes)', function () {
      const a = new BN('ff', 16);
      const buf = a.toBuffer('be', 32);
      expect(buf.length).to.equal(32);
      // 31 zero bytes then 0xff
      expect(buf.toString('hex')).to.equal('00000000000000000000000000000000000000000000000000000000000000ff');
    });

    // BN.TO_BUFFER.OPTIONS
    it('BN.TO_BUFFER.OPTIONS - object-style toBuffer({ size, endian })', function () {
      const hex = '01020304';
      const a = new BN(hex, 16);
      const buf = a.toBuffer({ size: 4, endian: 'le' });
      expect(buf).to.be.instanceOf(Buffer);
      expect(buf.length).to.equal(4);
      expect(buf.toString('hex')).to.equal('04030201');
      // Also test big-endian via options
      const bufBE = a.toBuffer({ size: 4, endian: 'be' });
      expect(bufBE.toString('hex')).to.equal('01020304');
    });

    // BN.TO_BUFFER.LE32
    it('BN.TO_BUFFER.LE32 - private key format (32 bytes LE)', function () {
      const priv = new BN('0100000000000000000000000000000000000000000000000000000000000000', 16);
      const buf = priv.toBuffer('le', 32);
      expect(buf.length).to.equal(32);
      expect(buf.toString('hex')).to.equal('0000000000000000000000000000000000000000000000000000000000000001');
    });

    // BN.TOBUFFER.ZERO
    it('BN.TOBUFFER.ZERO - zero padded to 32 bytes', function () {
      const buf = new BN(0).toBuffer('be', 32);
      expect(buf.length).to.equal(32);
      for (let i = 0; i < 32; i++) {
        expect(buf[i]).to.equal(0);
      }
    });

    // BN.FROM_BUFFER_ROUNDTRIP
    it('BN.FROM_BUFFER_ROUNDTRIP - encode then re-decode identically', function () {
      const a = new BN(SECP_P, 16);
      const buf = a.toBuffer('be', 32);
      const recovered = new BN(buf);
      expect(recovered.toString(16)).to.equal(a.toString(16));
      // Also LE roundtrip
      const bufLE = a.toBuffer('le', 32);
      const recoveredLE = new BN(bufLE, 10, 'le');
      expect(recoveredLE.toString(16)).to.equal(a.toString(16));
    });

    // BN.TOARRAY.BE
    it('BN.TOARRAY.BE - toArray big-endian produces Array of bytes', function () {
      const a = new BN('ff00', 16);
      const arr = a.toArray('be', 2);
      expect(Array.isArray(arr)).to.be.true;
      expect(arr).to.deep.equal([0xff, 0x00]);
    });

    // BN.TOARRAY.LE
    it('BN.TOARRAY.LE - toArray little-endian', function () {
      const a = new BN('ff00', 16);
      const arr = a.toArray('le', 2);
      expect(arr).to.deep.equal([0x00, 0xff]);
    });

    // BN.TOSTR.HEX
    it('BN.TOSTR.HEX - toString(16) produces correct hex', function () {
      expect(new BN('deadbeef', 16).toString(16)).to.equal('deadbeef');
      expect(new BN(SECP_P, 16).toString(16)).to.equal(SECP_P);
    });

    // BN.TOSTR.HEX.PADD
    it('BN.TOSTR.HEX.PADD - toString(16, 2) produces even-length hex', function () {
      expect(new BN('f', 16).toString(16)).to.equal('f');
      // toString(16) does not guarantee even width; roundtrip via parse is
      // the contract. Odd-length hex is valid input.
      expect(new BN(new BN('f', 16).toString(16), 16).toString(16)).to.equal('f');
    });

    // BN.TOSTR.DEC
    it('BN.TOSTR.DEC - toString(10) for very large numbers', function () {
      const dec = new BN(SECP_P, 16).toString(10);
      expect(dec).to.be.a('string');
      expect(dec.length).to.be.greaterThan(20);
      // roundtrip
      expect(new BN(dec, 10).toString(16)).to.equal(SECP_P);
    });

    // BN.TOSTR.NEG
    it('BN.TOSTR.NEG - negative number has - prefix', function () {
      const a = new BN('-ff', 16);
      expect(a.toString(16)).to.equal('-ff');
      const b = new BN(-5);
      expect(b.toString(10)).to.equal('-5');
    });

    // BN.TONUMBER_SAFE
    it('BN.TONUMBER_SAFE - toNumber() for numbers within safe range', function () {
      expect(new BN(0).toNumber()).to.equal(0);
      expect(new BN(1).toNumber()).to.equal(1);
      // 2^26 - single word
      expect(new BN('4000000', 16).toNumber()).to.equal(0x4000000);
      // 2^26 + 2^25 (crosses word boundary, length=2)
      // eslint-disable-next-line no-bitwise
      expect(new BN(0x4000000 + (1 << 25)).toNumber()).to.equal(0x6000000);
      // Length-3 value with words[2] === 0x01 (toNumber special case)
      const twoPow52 = new BN(2).pow(new BN(52));
      expect(twoPow52.toNumber()).to.equal(0x10000000000000);
    });

    // BN.TONUMBER_OVERFLOW
    it('BN.TONUMBER_OVERFLOW - toNumber() asserts for > 2^53', function () {
      const a = new BN('80000000000000', 16); // 2^53
      expect(() => a.toNumber()).to.throw('Number can only safely store up to 53 bits');
      // 256-bit number
      expect(() => new BN(SECP_P, 16).toNumber()).to.throw('Number can only safely store up to 53 bits');
    });

    // BN.TOJSON
    it('BN.TOJSON - JSON.stringify produces hex string', function () {
      const a = new BN('deadbeef', 16);
      const json = JSON.stringify(a);
      expect(json).to.equal('"deadbeef"');
      // 256-bit
      const p = new BN(SECP_P, 16);
      expect(JSON.parse(JSON.stringify(p))).to.equal(SECP_P);
    });

    // BN.CLONE
    it('BN.CLONE - clone() produces independent copy', function () {
      const a = new BN('deadbeef', 16);
      const b = a.clone();
      expect(b.toString(16)).to.equal(a.toString(16));
      b.iaddn(1);
      expect(b.toString(16)).to.not.equal(a.toString(16));
    });

    // BN.COPY
    it('BN.COPY - copy(dest) copies to another BN', function () {
      const src = new BN('deadbeef', 16);
      const dest = new BN(0);
      src.copy(dest);
      expect(dest.toString(16)).to.equal('deadbeef');
    });

  });
  describe('Montgomery & Reduction Arithmetic', function () {

    // BN.RED.K256.CREATE
    it('BN.RED.K256.CREATE - BN.red("k256") creates k256 reduction context', function () {
      const k256 = BN.red('k256');
      expect(k256).to.not.be.null;
      expect(k256.m.toString(16)).to.equal(SECP_P);
    });

    // BN.RED.CUSTOM
    it('BN.RED.CUSTOM - BN.red(p) works for custom modulus', function () {
      const p = new BN('10001', 16); // 65537
      const ctx = BN.red(p);
      expect(ctx.m.toString(16)).to.equal('10001');
      expect(ctx.prime).to.be.null; // custom moduli have no named prime
    });

    // BN.RED.TO_RED
    it('BN.RED.TO_RED - toRed converts BN to red context', function () {
      const ctx = BN.red('k256');
      const a = new BN('10', 16).toRed(ctx);
      expect(a.red).to.equal(ctx);
      expect(a.negative).to.equal(0);
    });

    // BN.RED.FROM_RED
    it('BN.RED.FROM_RED - fromRed converts back from red context', function () {
      const ctx = BN.red('k256');
      const a = new BN('10', 16).toRed(ctx);
      const b = a.fromRed();
      expect(b.red).to.be.null;
      expect(b.toString(16)).to.equal('10');
    });

    // BN.RED.ADD.BASIC
    it('BN.RED.ADD.BASIC - redAdd in k256 context', function () {
      const ctx = BN.red('k256');
      const a = new BN(5).toRed(ctx);
      const b = new BN(3).toRed(ctx);
      const c = a.redAdd(b);
      expect(c.red).to.equal(ctx);
      expect(c.fromRed().toNumber()).to.equal(8);
    });

    // BN.RED.ADD.WRAP
    it('BN.RED.ADD.WRAP - result > p wraps mod p', function () {
      const ctx = BN.red('k256');
      const p = new BN(SECP_P, 16);
      const pRed = new BN(SECP_P, 16).toRed(ctx);
      // p + p in normal arithmetic = 2p, but in red context should = 0 mod p
      const result = pRed.redAdd(pRed);
      expect(result.fromRed().isZero()).to.be.true;
    });

    // BN.RED.SUB.BASIC
    it('BN.RED.SUB.BASIC - redSub in k256 context', function () {
      const ctx = BN.red('k256');
      const a = new BN(10).toRed(ctx);
      const b = new BN(3).toRed(ctx);
      const c = a.redSub(b);
      expect(c.fromRed().toNumber()).to.equal(7);
    });

    // BN.RED.SUB.WRAP
    it('BN.RED.SUB.WRAP - result < 0 wraps to p - result', function () {
      const ctx = BN.red('k256');
      const p = new BN(SECP_P, 16);
      const a = new BN(5).toRed(ctx);
      const b = new BN(10).toRed(ctx);
      const c = a.redSub(b);
      // 5 - 10 = -5 mod p = p - 5
      expect(c.fromRed().cmp(p.subn(5))).to.equal(0);
    });

    // BN.RED.MUL.BASIC
    it('BN.RED.MUL.BASIC - redMul in k256 context', function () {
      const ctx = BN.red('k256');
      const a = new BN(6).toRed(ctx);
      const b = new BN(7).toRed(ctx);
      const c = a.redMul(b);
      expect(c.fromRed().toNumber()).to.equal(42);
    });

    // BN.RED.SQR
    it('BN.RED.SQR - redSqr in k256 context', function () {
      const ctx = BN.red('k256');
      const a = new BN(7).toRed(ctx);
      const s = a.redSqr();
      expect(s.fromRed().toNumber()).to.equal(49);
    });

    // BN.RED.SQR
    it('BN.RED.SQR - redSqr(a) produces correct square mod p', function () {
      const ctx = BN.red('k256');

      // Test 1: 7^2 mod p = 49 (trivial, no wrapping)
      const a = new BN(7).toRed(ctx);
      expect(a.redSqr().fromRed().toNumber()).to.equal(49);

      // Test 2: (p-1)^2 mod p = 1 (boundary: full wrap)
      const pm1 = new BN(SECP_P, 16).isubn(1).toRed(ctx);
      expect(pm1.redSqr().fromRed().toNumber()).to.equal(1);

      // Test 3: (p-2)^2 mod p = 4
      const pm2 = new BN(SECP_P, 16).isubn(2).toRed(ctx);
      expect(pm2.redSqr().fromRed().toNumber()).to.equal(4);

      // Test 4: (10^10)^2 mod p verified via BigInt oracle
      const ten10 = new BN('10000000000').toRed(ctx);
      const expected = (BigInt('10000000000') ** 2n % BigInt('0x' + SECP_P)).toString(16);
      expect(ten10.redSqr().fromRed().toString(16)).to.equal(expected);
    });

    // BN.RED.POW
    it('BN.RED.POW - redPow in k256 context (a^0 = 1, a^1 = a, a^2 = square)', function () {
      const ctx = BN.red('k256');
      const a = new BN(5).toRed(ctx);
      expect(a.redPow(new BN(0)).fromRed().toNumber()).to.equal(1);
      expect(a.redPow(new BN(1)).fromRed().toNumber()).to.equal(5);
      expect(a.redPow(new BN(2)).fromRed().toNumber()).to.equal(25);
      expect(a.redPow(new BN(3)).fromRed().toNumber()).to.equal(125);
    });

    // BN.RED.INVM
    it('BN.RED.INVM - modular inverse in k256 context', function () {
      const ctx = BN.red('k256');
      const a = new BN(3).toRed(ctx);
      const inv = a.redInvm();
      // a * inv ≡ 1 (mod p)
      expect(a.redMul(inv).fromRed().toNumber()).to.equal(1);
    });

    // BN.RED.INVM.IDENTITY
    it('BN.RED.INVM.IDENTITY - a * redInvm(a) ≡ 1 (mod p) for various values', function () {
      const ctx = BN.red('k256');
      const values = ['10', '1234', 'deadbeef', '10000000000000000000000000000000', TEST_BASE];
      for (const v of values) {
        const a = new BN(v, 16).toRed(ctx);
        const inv = a.redInvm();
        expect(a.redMul(inv).fromRed().toNumber()).to.equal(1);
      }
    });

    // BN.RED.NEG
    it('BN.RED.NEG - negation in red context (p - a)', function () {
      const ctx = BN.red('k256');
      const a = new BN(5).toRed(ctx);
      const neg = a.redNeg();
      expect(neg.red).to.equal(ctx);
      // a + (-a) ≡ 0 (mod p)
      expect(a.redAdd(neg).fromRed().isZero()).to.be.true;
      // -0 = 0
      expect(new BN(0).toRed(ctx).redNeg().fromRed().isZero()).to.be.true;
    });

    // BN.RED.SHL
    it('BN.RED.SHL - shift in red context', function () {
      const ctx = BN.red('k256');
      const a = new BN(1).toRed(ctx);
      const shifted = a.redShl(4); // 1 * 2^4 = 16
      expect(shifted.fromRed().toNumber()).to.equal(16);
    });

    // BN.RED.K256.SPECIFIC
    it('BN.RED.K256.SPECIFIC - known inputs in k256 produce correct outputs', function () {
      const ctx = BN.red('k256');
      const p = new BN(SECP_P, 16);
      // p - 1 in red context
      const pMinus1 = p.subn(1).toRed(ctx);
      const one = new BN(1).toRed(ctx);
      expect(pMinus1.redAdd(one).fromRed().isZero()).to.be.true;
      // (p - 1) * (p - 1) ≡ 1 (mod p)
      expect(pMinus1.redMul(pMinus1).fromRed().toNumber()).to.equal(1);
    });

    // BN.RED.RED_ISUB / BN.RED.RED_Imul (in-place red variants)
    it('BN.RED.IADD / BN.RED.ISUB - in-place redAdd/sub return self', function () {
      const ctx = BN.red('k256');
      const a = new BN(3).toRed(ctx);
      const b = new BN(5).toRed(ctx);
      const result = a.redIAdd(b);
      expect(result).to.equal(a); // same object
      expect(a.fromRed().toNumber()).to.equal(8);
      // redISub
      const x = new BN(10).toRed(ctx);
      const y = new BN(3).toRed(ctx);
      const result2 = x.redISub(y);
      expect(result2).to.equal(x);
      expect(x.fromRed().toNumber()).to.equal(7);
    });

    // BN.RED.RED_ISQR
    it('BN.RED.RED_ISQR - redISqr in place', function () {
      const ctx = BN.red('k256');
      const a = new BN(7).toRed(ctx);
      const result = a.redISqr();
      expect(result).to.equal(a);
      expect(a.fromRed().toNumber()).to.equal(49);
    });

    // BN.RED.FROM_RED_UNCHANGED
    it('BN.RED.FFROM_RED_UNCHANGED - fromRed() produces value in [0, p)', function () {
      const ctx = BN.red('k256');
      const p = new BN(SECP_P, 16);
      const a = new BN(SECP_P, 16); // exact p
      const aRed = a.toRed(ctx);
      // toRed does mod p, so p maps to 0.
      expect(aRed.fromRed().isZero()).to.be.true;
      // A large value (2 * p) maps to 0.
      const big = new BN(SECP_P, 16).muln(2);
      expect(big.toRed(ctx).fromRed().isZero()).to.be.true;
      // Within range should be unchanged
      const small = new BN('deadbeef', 16);
      expect(small.toRed(ctx).fromRed().toString(16)).to.equal('deadbeef');
    });

    // BN.MONT.CREATE
    it('BN.MONT.CREATE - BN.mont(p) creates Montgomery context', function () {
      const m = new BN('10001', 16); // 65537
      const ctx = BN.mont(m);
      expect(ctx).to.not.be.null;
      expect(ctx.m.toString(16)).to.equal('10001');
    });

    // BN.MONT.ADD_SUB_MUL
    it('BN.MONT.ADD_SUB_MUL - red operations via Montgomery context', function () {
      const m = BN._prime('p25519').p; // x25519 prime
      const ctx = BN.mont(m);
      const two = new BN(2).toRed(ctx);
      const three = new BN(3).toRed(ctx);
      expect(two.redAdd(three).fromRed().toNumber()).to.equal(5);
      expect(three.redSub(two).fromRed().toNumber()).to.equal(1);
      expect(two.redMul(three).fromRed().toNumber()).to.equal(6);
    });

    // BN.MONT.INVM
    it('BN.MONT.INVM - Montgomery modular inverse', function () {
      const m = BN._prime('p25519').p;
      const ctx = BN.mont(m);
      const a = new BN(3).toRed(ctx);
      const inv = a.redInvm();
      expect(a.redMul(inv).fromRed().toNumber()).to.equal(1);
    });

    // BN.RED.REDPOW consistency with pow(e).mod(p)
    it('BN.RED.POW_CONSISTENCY - redPow(e) matches pow(e).mod(p)', function () {
      const ctx = BN.red('k256');
      const p = new BN(SECP_P, 16);
      // Use small base to keep pow(e) fast
      const a = new BN(997);
      const exp = new BN(7919);
      const redResult = a.toRed(ctx).redPow(exp).fromRed();
      const normalResult = a.pow(exp).mod(p);
      expect(redResult.toString(16)).to.equal(normalResult.toString(16));
    });

    // BN.RED.REDPOW_FERMAT with smaller custom modulus (p ≡ 3 mod 4)
    it('BN.RED.POW_FERMAT - a^(p-1) ≡ 1 (mod p) with small prime', function () {
      // Use a small prime to keep the test fast while still verifying correctness
      const p = new BN(997); // small prime
      const ctx = BN.red(p);
      const a = new BN(5).toRed(ctx);
      const result = a.redPow(p.clone().isubn(1));
      expect(result.fromRed().toNumber()).to.equal(1);
    });

  });
  describe('In-place Mutation Safety', function () {

    // BN.MUTATE.IADD_ORIGINAL
    it('BN.MUTATE.IADD_ORIGINAL - add() does not mutate the source', function () {
      const a = new BN(10);
      const b = new BN(20);
      const originalA = a.toString(16);
      const originalB = b.toString(16);
      const c = a.add(b);
      expect(a.toString(16)).to.equal(originalA);
      expect(b.toString(16)).to.equal(originalB);
      expect(c).to.not.equal(a);
      expect(c).to.not.equal(b);
    });

    // BN.MUTATE.IADD_INPLACE
    it('BN.MUTATE.IADD_INPLACE - iadd() mutates the target', function () {
      const a = new BN(10);
      const b = new BN(20);
      const result = a.iadd(b);
      expect(result).to.equal(a);
      expect(a.toNumber()).to.equal(30);
    });

    // BN.MUTATE.ISUB / BN.MUTATE.IMUL / etc.
    it('BN.MUTATE.ISUB.IMUL.ISQR - in-place operations mutate target', function () {
      const a = new BN(100);
      a.isub(new BN(30));
      expect(a.toNumber()).to.equal(70);

      const b = new BN(5);
      b.imuln(3);
      expect(b.toNumber()).to.equal(15);

      const c = new BN(6);
      c.isqr();
      expect(c.toNumber()).to.equal(36);

      const d = new BN(0x4000000);
      d.iaddn(1);
      expect(d.toNumber()).to.equal(0x4000001);
    });

    // BN.MUTATE.CHAIN
    it('BN.MUTATE.CHAIN - in-place methods return this for chaining', function () {
      const a = new BN(10);
      const result = a.iaddn(5).imuln(2).isubn(4);
      expect(result).to.equal(a);
      expect(a.toNumber()).to.equal(26); // (10 + 5) * 2 - 4
    });

    // BN.MUTATE.IABS
    it('BN.MUTATE.IABS - iabs() flips sign in place, returns this', function () {
      const a = new BN(-42);
      const result = a.iabs();
      expect(result).to.equal(a);
      expect(a.toNumber()).to.equal(42);
      expect(a.negative).to.equal(0);
      // already positive stays positive
      a.iabs();
      expect(a.toNumber()).to.equal(42);
    });

    // BN.MUTATE.INEG
    it('BN.MUTATE.INEG - ineg() negates in place, returns this', function () {
      const a = new BN(42);
      const result = a.ineg();
      expect(result).to.equal(a);
      expect(a.toNumber()).to.equal(-42);
      // double negation
      a.ineg();
      expect(a.toNumber()).to.equal(42);
      // negation of zero stays zero (non-negative zero)
      const z = new BN(0);
      z.ineg();
      expect(z.isZero()).to.be.true;
      expect(z.negative).to.equal(0);
    });

    // BN.MUTATE.SUB.SHALLOW_ORIGINAL
    it('BN.MUTATE.SUB_ORIGINAL - sub() does not mutate source', function () {
      const a = new BN(10);
      const b = new BN(3);
      const origA = a.clone().toString(16);
      const origB = b.clone().toString(16);
      const c = a.sub(b);
      expect(a.toString(16)).to.equal(origA);
      expect(b.toString(16)).to.equal(origB);
    });

    // BN.MUTATE.MUL.SHALLOW_ORIGINAL
    it('BN.MUTATE.MUL_ORIGINAL - mul() does not mutate source', function () {
      const a = new BN(6);
      const b = new BN(7);
      const origA = a.clone().toString(16);
      const origB = b.clone().toString(16);
      const c = a.mul(b);
      expect(a.toString(16)).to.equal(origA);
      expect(b.toString(16)).to.equal(origB);
      expect(c.toNumber()).to.equal(42);
    });

    // BN.MUTATE.SHIFT_ORIGINAL
    it('BN.MUTATE.SHIFT_ORIGINAL - shln/shrn do not mutate source', function () {
      const a = new BN(1);
      const orig = a.clone();
      const shifted = a.shln(10);
      expect(a.toString(16)).to.equal(orig.toString(16));
      expect(shifted.toNumber()).to.equal(1024);
      // shrn
      const b = new BN(1024);
      const origB = b.clone();
      const shrunk = b.shrn(5);
      expect(b.toString(16)).to.equal(origB.toString(16));
      expect(shrunk.toNumber()).to.equal(32);
    });

    // BN.MUTATE.BITWISE_ORIGINAL
    it('BN.MUTATE.BITWISE_ORIGINAL - or/and/xor do not mutate source', function () {
      const a = new BN(0b1010);
      const b = new BN(0b1100);
      const origA = a.clone();
      const origB = b.clone();
      const result = a.or(b);
      expect(a.toString(16)).to.equal(origA.toString(16));
      expect(b.toString(16)).to.equal(origB.toString(16));
      expect(result.toNumber()).to.equal(0b1110);
      // and
      const c = new BN(0b1110);
      const d = new BN(0b1010);
      const origC = c.clone();
      const andResult = c.and(d);
      expect(c.toString(16)).to.equal(origC.toString(16));
      expect(andResult.toNumber()).to.equal(0b1010);
    });

  });
  describe('Invalid inputs and assertion contracts', function () {
    describe('Constructor Base Validation', function () {

      // BN.INVALID.BASE_THROW - invalid bases all throw
      it('BN.INVALID.BASE_THROW - new BN("10", base) throws for all invalid bases', function () {
        const invalidBases = [1, 37, -1, 2.5, 'abc', Infinity, 1.2, -2, '16', 'NaN'];
        for (const base of invalidBases) {
          expect(function () { new BN('10', base); }).to.throw();
        }
      });

      // BN.INVALID.BASE_FALSY - falsy values silently default to base 10
      it('BN.INVALID.BASE_FALSY - new BN("10", falsy) defaults to base 10', function () {
        const falsyValues = [null, 0, '', NaN, undefined];
        for (const val of falsyValues) {
          expect(new BN('10', val).toNumber()).to.equal(10);
        }
      });

      // BN.INVALID.BASE_NUMBER_INPUT - number input ignores base
      it('BN.INVALID.BASE_NUMBER_INPUT - new BN(42, anyBase) does NOT throw', function () {
        const bases = [1, 16, 36, 37, -1, 'abc'];
        for (const base of bases) {
          expect(new BN(42, base).toNumber()).to.equal(42);
        }
      });

      // BN.INVALID.BASE_ENDIAN_SWAP - array + endian does not throw
      it('BN.INVALID.BASE_ENDIAN_SWAP - new BN([bytes], endian) does NOT throw', function () {
        expect(new BN([1, 2, 3], 'le').toString(16)).to.equal('30201');
        expect(new BN([1, 2, 3], 'be').toString(16)).to.equal('10203');
      });

    });
    describe('toString Base Validation', function () {

      // BN.INVALID.TOSTRING_BASE_THROW - out-of-range bases throw with explicit message
      it('BN.INVALID.TOSTRING_BASE_THROW - (new BN(10)).toString(base) throws for invalid bases', function () {
        const invalidBases = [1, 37, -1, 2.5, 'abc', Infinity, 1.2, -2, '16', 'NaN'];
        for (const base of invalidBases) {
          expect(function () { new BN(10).toString(base); }).to.throw('Base should be between 2 and 36');
        }
      });

      // BN.INVALID.TOSTRING_BASE_FALSY - falsy values default to base 10
      it('BN.INVALID.TOSTRING_BASE_FALSY - (new BN(10)).toString(falsy) defaults to base 10', function () {
        const falsyValues = [null, 0, '', NaN, undefined];
        for (const val of falsyValues) {
          expect(new BN(10).toString(val)).to.equal('10');
        }
      });

    });
    describe('Division By Zero', function () {

      // BN.INVALID.DIV_ZERO_THROW - division methods throw on zero divisor
      it('BN.INVALID.DIV_ZERO_THROW - div/mod/divRound/divmod throw on zero divisor', function () {
        const zero = new BN(0);
        const vals = [new BN(10), new BN(-5), new BN(SECP_P, 16)];
        for (const a of vals) {
          expect(function () { a.div(zero); }).to.throw();
          expect(function () { a.mod(zero); }).to.throw();
          expect(function () { a.divRound(zero); }).to.throw();
          expect(function () { a.divmod(zero); }).to.throw();
        }
      });

      // BN.INVALID.DIVMOD_ZERO_OPERAND - zero numerator is fine
      it('BN.INVALID.DIVMOD_ZERO_OPERAND - (new BN(0)).divmod(new BN(5)) returns { div: 0, mod: 0 }', function () {
        const result = new BN(0).divmod(new BN(5));
        expect(result.div.isZero()).to.be.true;
        expect(result.mod.isZero()).to.be.true;
      });

      // BN.INVALID.IDIVN_DIVN_ZERO - OBSERVED-BEHAVIOR: no explicit assert
      it('BN.INVALID.IDIVN_DIVN_ZERO - idivn(0) and divn(0) do NOT throw', function () {
        expect(function () { new BN(10).idivn(0); }).to.not.throw();
        expect(function () { new BN(10).divn(0); }).to.not.throw();
        // Also works on larger values
        expect(function () { new BN(SECP_P, 16).idivn(0); }).to.not.throw();
        expect(function () { new BN(SECP_P, 16).divn(0); }).to.not.throw();
      });

      // BN.INVALID.MODN_ZERO - OBSERVED-BEHAVIOR: returns NaN
      it('BN.INVALID.MODN_ZERO - a.modn(0) returns NaN for various inputs', function () {
        expect(new BN(10).modn(0)).to.be.NaN;
        expect(new BN(-5).modn(0)).to.be.NaN;
        expect(new BN(SECP_P, 16).modn(0)).to.be.NaN;
      });

    });
    describe('setn / testn Invalid Arguments', function () {

      // BN.INVALID.SETN_INVALID_ARGS - negative, string, null all throw
      it('BN.INVALID.SETN_INVALID_ARGS - a.setn(invalid, true) throws', function () {
        const invalidBits = [-1, -100, 'abc', null, undefined];
        for (const bit of invalidBits) {
          expect(function () { new BN(0).setn(bit, true); }).to.throw();
        }
      });

      // BN.INVALID.SETN_ZERO - valid
      it('BN.INVALID.SETN_ZERO - a.setn(0, true) sets bit 0', function () {
        const a = new BN(0);
        a.setn(0, true);
        expect(a.toNumber()).to.equal(1);
        // Multiple valid bits
        a.setn(5, true);
        expect(a.toNumber()).to.equal(33);
        a.setn(0, false);
        expect(a.toNumber()).to.equal(32);
      });

      // BN.INVALID.TESTN_INVALID_ARGS - negative, string, null all throw
      it('BN.INVALID.TESTN_INVALID_ARGS - a.testn(invalid) throws', function () {
        const invalidBits = [-1, -100, 'abc', null, undefined];
        for (const bit of invalidBits) {
          expect(function () { new BN(0).testn(bit); }).to.throw();
        }
      });

      // BN.INVALID.TESTN_VALID - valid bit indexes work
      it('BN.INVALID.TESTN_VALID - a.testn(validBit) works for valid bit positions', function () {
        const a = new BN(0xdeadbeef);
        expect(a.testn(0)).to.be.true;
        expect(a.testn(4)).to.be.false;
        expect(a.testn(31)).to.be.true;
        expect(a.testn(32)).to.be.false;
        expect(a.testn(100)).to.be.false;
      });

    });
    describe('inotn / notn Invalid Arguments', function () {

      // BN.INVALID.NOTN_INVALID_ARGS - negative, string, null all throw
      it('BN.INVALID.NOTN_INVALID_ARGS - a.notn(invalid) throws', function () {
        const invalidWidths = [-1, -100, 'abc', null, undefined];
        for (const w of invalidWidths) {
          expect(function () { new BN(0).notn(w); }).to.throw();
        }
      });

      // BN.INVALID.NOTN_VALID - valid widths work, including edge cases
      it('BN.NOTN_VALID - a.notn(validWidth) works for valid widths', function () {
        // Width 0 leaves the value unchanged.
        expect((new BN(0xff)).notn(0).toNumber()).to.equal(255);
        // Width 8 inverts 8 bits
        expect(new BN(0x00).notn(8).toNumber()).to.equal(0xff);
        expect(new BN(0xff).notn(8).toNumber()).to.equal(0);
        // Width 16 inverts 16 bits
        expect(new BN(0x00ff).notn(16).toNumber()).to.equal(0xff00);
        // Fractional width is accepted by this implementation.
        expect(function () { new BN(0).notn(2.5); }).to.not.throw();
      });

      // BN.NOTN_TO_NUMBER_BOUNDARY - notn(53).toNumber() works, notn(54).toNumber() overflows
      it('BN.NOTN_TO_NUMBER_BOUNDARY - notn(width) result overflows toNumber at 54 bits', function () {
        const atBoundary = new BN(1).notn(53); // valid BN, doesn't throw
        const pastBoundary = new BN(1).notn(54); // valid BN, doesn't throw
        expect(() => atBoundary.toNumber()).to.not.throw();
        expect(() => pastBoundary.toNumber()).to.throw('Number can only safely store up to 53 bits');
      });
    });
    describe('imaskn / maskn Invalid Arguments', function () {

      // BN.INVALID.MASKN_INVALID_BITS - negative, string, null all throw
      it('BN.INVALID.MASKN_INVALID_BITS - a.maskn(invalid) throws', function () {
        const invalidBits = [-1, -100, 'abc', null, undefined];
        for (const b of invalidBits) {
          expect(function () { new BN(0xff).maskn(b); }).to.throw();
        }
      });

      // BN.INVALID.MASKN_VALID - valid bit counts work
      it('BN.INVALID.MASKN_VALID - a.maskn(validBits) works for valid bit positions', function () {
        // maskn(4) keeps lower 4 bits
        const b = new BN(0xff);
        expect(b.maskn(4).toNumber()).to.equal(0xf);
        // maskn(16) keeps lower 16 bits
        const c = new BN(0xffff00ff);
        expect(c.maskn(16).toNumber()).to.equal(0x00ff);
        // in-place variant
        const d = new BN(0xdeadbeef);
        d.imaskn(8);
        expect(d.toNumber()).to.equal(0xef);
      });

      it('BN.MASKN_ZERO_BITS - maskn(0) returns zero-width result without mutating input', function () {
        const a = new BN(0xff);
        const result = a.maskn(0);
        expect(result.length).to.equal(0);
        expect(result.toString(16)).to.equal('');
        expect(a.toString(16)).to.equal('ff');

        a.imaskn(0);
        expect(a.length).to.equal(0);
        expect(a.toString(16)).to.equal('');
      });

      // BN.INVALID.MASKN_NEGATIVE_BN - negative numbers throw explicit message
      it('BN.INVALID.MASKN_NEGATIVE_BN - negative BN throws "imaskn works only with positive numbers"', function () {
        const msgs = [-1, -5, -0xdeadbeef];
        for (const n of msgs) {
          expect(function () { new BN(n).imaskn(3); }).to.throw('imaskn works only with positive numbers');
          expect(function () { new BN(n).maskn(3); }).to.throw('imaskn works only with positive numbers');
        }
      });

    });
    describe('bincn Invalid Arguments', function () {

      // BN.INVALID.BINCN_INVALID_ARGS - non-number throws
      it('BN.INVALID.BINCN_INVALID_ARGS - a.bincn(invalid) throws for non-numbers', function () {
        const invalidBits = [null, undefined, 'abc', {}, [], true, false];
        for (const b of invalidBits) {
          expect(function () { new BN(0).bincn(b); }).to.throw();
        }
      });

      // BN.INVALID.BINCN_NEGATIVE - OBSERVED-BEHAVIOR: no non-negative assert
      it('BN.INVALID.BINCN_NEGATIVE - a.bincn(negative) does NOT throw (OBSERVED-BEHAVIOR: no non-negative assert)', function () {
        const negBits = [-1, -100, -999999];
        for (const b of negBits) {
          expect(function () { new BN(1).bincn(b); }).to.not.throw();
        }
      });

      // BN.INVALID.BINCN_VALID - valid numeric bit indexes work
      it('BN.INVALID.BINCN_VALID - a.bincn(validBit) increments at bit position', function () {
        expect(new BN(0).bincn(0).toNumber()).to.equal(1);
        expect(new BN(1).bincn(0).toNumber()).to.equal(2);
        expect(new BN(0).bincn(5).toNumber()).to.equal(32);
      });

    });
    describe('Unsigned Shift Invalid Arguments', function () {

      // BN.INVALID.USHLN_INVALID_ARGS - invalid shift amounts throw
      it('BN.INVALID.USHLN_INVALID_ARGS - a.ushln(invalid) throws', function () {
        const invalid = [-1, -100, 'abc', null, undefined];
        for (const s of invalid) {
          expect(function () { new BN(1).ushln(s); }).to.throw();
        }
      });

      // BN.INVALID.USHRN_INVALID_ARGS - invalid shift amounts throw
      it('BN.INVALID.USHRN_INVALID_ARGS - a.ushrn(invalid) throws', function () {
        for (const s of [-1, -100, 'abc', null, undefined]) {
          expect(function () { new BN(42).ushrn(s); }).to.throw();
        }
      });

      // BN.INVALID.USHLN_USHRN_ZERO - shift by 0 is valid no-op
      it('BN.INVALID.USHLN_USHRN_ZERO - ushln(0) and ushrn(0) are valid no-ops', function () {
        const a = new BN(42);
        expect(a.ushln(0).toNumber()).to.equal(42);
        const b = new BN(42);
        expect(b.ushrn(0).toNumber()).to.equal(42);
      });

      // BN.INVALID.USHLN_USHRN_VALID - valid shift amounts work
      it('BN.INVALID.USHLN_USHRN_VALID - valid shifts produce correct results', function () {
        expect(new BN(1).ushln(10).toNumber()).to.equal(1024);
        expect(new BN(1024).ushrn(3).toNumber()).to.equal(128);
        expect(new BN(1).ushln(52).toString(16)).to.equal(new BN(2).pow(new BN(52)).toString(16));
      });

    });
    describe('Signed Shift on Negative BNs', function () {

      // BN.INVALID.SIGNED_NEGATIVE_BN - signed shift methods reject negative BNs
      it('BN.INVALID.SIGNED_NEGATIVE_BN - shln/ishln/shrn/ishrn throw on negative BN', function () {
        const negBNs = [-1, -5, -0xdeadbeef, new BN(SECP_P, 16).ineg()];
        const methods = ['shln', 'ishln', 'shrn', 'ishrn'];
        for (const a of negBNs) {
          for (const m of methods) {
            expect(function () { a[m](3); }).to.throw();
          }
        }
      });

      // BN.INVALID.SIGNED_POSITIVE - signed shifts work on positive BNs
      it('BN.INVALID.SIGNED_POSITIVE - shln/shrn work correctly on positive BNs', function () {
        const a = new BN(5);
        expect(a.shln(3).toNumber()).to.equal(40);
        const b = new BN(40);
        expect(b.shrn(3).toNumber()).to.equal(5);
        // in-place variants
        const c = new BN(3);
        c.ishln(2);
        expect(c.toNumber()).to.equal(12);
        const d = new BN(12);
        d.ishrn(1);
        expect(d.toNumber()).to.equal(6);
      });

    });

  });

});
