/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Utils } = require('../');
const { expect } = require('chai');

const {
  assert,
  toArray,
  zero2,
  toHex,
  encode,
  getNAF,
  getJSF,
  cachedProperty,
  parseBytes,
  intFromLE
} = Utils;

function expectArrayWithNaN(actual, expected) {
  expect(actual).to.have.lengthOf(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (Number.isNaN(expected[i])) {
      expect(Number.isNaN(actual[i])).to.equal(true);
    } else {
      expect(actual[i]).to.equal(expected[i]);
    }
  }
}

function expectBNValue(actual, expected) {
  expect(actual.cmp(expected)).to.equal(0);
}

function nafToBN(naf) {
  let result = new BN(0);
  for (let i = 0; i < naf.length; i++) {
    if (naf[i] > 0) {
      result = result.add(new BN(naf[i]).ushln(i));
    } else if (naf[i] < 0) {
      result = result.isub(new BN(-naf[i]).ushln(i));
    }
  }
  return result;
}

function localBN(hex) {
  return new BN(hex, 16);
}

describe('Utils.assert', function () {
  it('throws for falsy values', function () {
    for (const val of [false, 0, '', null, undefined])
      expect(function () { assert(val); }).to.throw(Error, 'Assertion failed');
  });

  it('throws with a custom message', function () {
    expect(function () { assert(false, 'my error'); }).to.throw(Error, 'my error');
  });

  it('does not throw for truthy values', function () {
    for (const val of [true, 1, 'yes'])
      expect(function () { assert(val); }).to.not.throw();
  });
});

describe('Utils.toArray', function () {
  it('converts ordinary strings to byte arrays', function () {
    const cases = [
      { input: 'abc', expected: [97, 98, 99] },
      { input: 'hello', expected: [104, 101, 108, 108, 111] },
      { input: 'a', expected: [97] },
      { input: '\u1234234', expected: [0x12, 0x34, 0x32, 0x33, 0x34] },
      { input: '', expected: [] },
      { input: null, expected: [] },
      { input: undefined, expected: [] }
    ];

    for (const { input, expected } of cases)
      expect(toArray(input)).to.deep.equal(expected);
  });

  it('parses hex strings after removing non-hex separators', function () {
    const cases = [
      { input: 'deadbeef', expected: [0xde, 0xad, 0xbe, 0xef] },
      { input: '00ff01', expected: [0x00, 0xff, 0x01] },
      { input: 'DEADBEEF', expected: [0xde, 0xad, 0xbe, 0xef] },
      { input: 'abc', expected: [0x0a, 0xbc] },
      { input: '12 34', expected: [0x12, 0x34] },
      { input: '12:34', expected: [0x12, 0x34] },
      { input: 'f', expected: [0x0f] },
      { input: '', expected: [] }
    ];

    for (const { input, expected } of cases)
      expect(toArray(input, 'hex')).to.deep.equal(expected);
  });

  it('preserves parseInt behavior for invalid hex pairs', function () {
    expectArrayWithNaN(toArray('zz', 'hex'), [NaN]);
    expect(toArray('1g', 'hex')).to.deep.equal([0x01]);
  });

  it('copies arrays without reusing the input reference', function () {
    const input = [1, 2, 3];
    const result = toArray(input);

    expect(result).to.deep.equal(input);
    expect(result).to.not.equal(input);
  });

  it('converts array-like inputs with integer coercion', function () {
    expect(toArray(Buffer.from([1, 2, 255]))).to.deep.equal([1, 2, 255]);
    expect(toArray({ 0: '5', 1: 258, length: 2 })).to.deep.equal([5, 258]);
  });
});

describe('Utils.zero2', function () {
  it('left-pads one-character strings', function () {
    expect(zero2('0')).to.equal('00');
    expect(zero2('1')).to.equal('01');
    expect(zero2('f')).to.equal('0f');
  });

  it('leaves other strings unchanged', function () {
    for (const word of ['01', '100', '-1', ''])
      expect(zero2(word)).to.equal(word);
  });
});

describe('Utils.toHex', function () {
  it('encodes array entries as concatenated hex words', function () {
    const cases = [
      { input: [], expected: '' },
      { input: [0, 1, 2, 3], expected: '00010203' },
      { input: [15, 16, 255], expected: '0f10ff' },
      { input: [256, 512], expected: '100200' },
      { input: [-1, -16], expected: '-1-10' }
    ];

    for (const { input, expected } of cases)
      expect(toHex(input)).to.equal(expected);
  });
});

describe('Utils.encode', function () {
  it('returns a hex string for hex encoding', function () {
    expect(encode([0, 1, 255], 'hex')).to.equal('0001ff');
    expect(encode([10, 11, 12], 'hex')).to.equal('0a0b0c');
    expect(encode([256, 512], 'hex')).to.equal('100200');
  });

  it('returns the original array for non-hex encodings', function () {
    for (const enc of ['binary', 'utf8', 'base64', undefined, null]) {
      const input = [1, 2, 3];
      expect(encode(input, enc)).to.equal(input);
    }
  });
});

describe('Utils.getNAF', function () {
  it('matches explicit NAF fixtures', function () {
    const cases = [
      { hex: '0', w: 1, expected: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { hex: '1', w: 2, expected: [1, 0, 0, 0, 0, 0, 0, 0, 0] },
      { hex: '7', w: 2, expected: [-3, -1, 3, 0, 0, 0, 0, 0, 0] },
      { hex: 'f', w: 3, expected: [-7, -3, 7, 0, 0, 0, 0, 0, 0] },
      {
        hex: 'deadbeef',
        w: 5,
        expected: [
          -15, -31, 15, 0, 0, 0, 0, 0, -31, -15, -31, 15, 0, 0, 0, 0, 0,
          23, 0, 0, 0, 0, 0, -29, -13, -29, 13, 0, 0, 0, 0, 0, 1
        ]
      }
    ];

    for (const { hex, w, expected } of cases) {
      const bits = Math.max(localBN(hex).bitLength(), 8);
      expect(getNAF(localBN(hex), w, bits)).to.deep.equal(expected);
    }
  });

  it('reconstructs the original scalar and keeps digits inside the window', function () {
    const scalarHex = [
      '0', '1', '2', '3', '7', '8', 'f', '10', '1f', '7f',
      '80', 'ff', '100', 'deadbeef'
    ];
    const windowSet = [1, 2, 3, 4, 5];

    for (const hex of scalarHex) {
      for (const w of windowSet) {
        const k = localBN(hex);
        const naf = getNAF(k, w, Math.max(k.bitLength(), 8));

        expectBNValue(nafToBN(naf), k);
        for (const digit of naf) {
          expect(Math.abs(digit)).to.be.lessThan(1 << w);
          if (digit !== 0)
            expect(Math.abs(digit) % 2).to.equal(1);
        }
      }
    }
  });
});

describe('Utils.getJSF', function () {
  it('matches explicit JSF fixtures', function () {
    const cases = [
      { a: '0', b: '0', expected: [[], []] },
      { a: '1', b: '1', expected: [[1], [1]] },
      { a: '2', b: '3', expected: [[0, 1], [1, 1]] },
      { a: '7', b: '8', expected: [[-1, 0, 0, 1], [0, 0, 0, 1]] },
      { a: 'ff', b: '100', expected: [[-1, 0, 0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0, 1]] }
    ];

    for (const { a, b, expected } of cases)
      expect(getJSF(localBN(a), localBN(b))).to.deep.equal(expected);
  });

  it('reconstructs both original scalars with digits in {-1, 0, 1}', function () {
    const pairs = [
      ['0', '0'],
      ['1', '0'],
      ['0', '1'],
      ['1', '1'],
      ['2', '3'],
      ['3', '4'],
      ['7', '7'],
      ['7', '8'],
      ['f', '10'],
      ['1f', '20'],
      ['7f', '80'],
      ['ff', 'ff'],
      ['ff', '100'],
      ['deadbeef', 'deadbef0']
    ];

    for (const [a, b] of pairs) {
      const jsf = getJSF(localBN(a), localBN(b));
      expectBNValue(nafToBN(jsf[0]), localBN(a));
      expectBNValue(nafToBN(jsf[1]), localBN(b));

      for (const digits of jsf) {
        for (const digit of digits)
          expect([-1, 0, 1]).to.include(digit);
      }
    }
  });
});

describe('Utils.cachedProperty', function () {
  it('computes once and caches on the expected underscored key', function () {
    function Example() {
      this.calls = 0;
    }

    cachedProperty(Example, 'answer', function () {
      this.calls++;
      return 42;
    });

    const example = new Example();
    expect(example.answer()).to.equal(42);
    expect(example.answer()).to.equal(42);
    expect(example.calls).to.equal(1);
    expect(example._answer).to.equal(42);
  });
});

describe('Utils.parseBytes', function () {
  it('parses string input as hex bytes', function () {
    expect(parseBytes('deadbeef')).to.deep.equal([0xde, 0xad, 0xbe, 0xef]);
    expect(parseBytes('abc')).to.deep.equal([0x0a, 0xbc]);
    expect(parseBytes('12 34')).to.deep.equal([0x12, 0x34]);
    expectArrayWithNaN(parseBytes('zz'), [NaN]);
  });

  it('returns non-string input unchanged', function () {
    const input = [1, 2, 3];
    expect(parseBytes(input)).to.equal(input);
  });
});

describe('Utils.intFromLE', function () {
  it('constructs a BN from little-endian bytes', function () {
    const cases = [
      { bytes: [], expected: '0' },
      { bytes: [1], expected: '1' },
      { bytes: [1, 2, 3], expected: '30201' },
      { bytes: [0xff, 0x00, 0x10], expected: '1000ff' }
    ];

    for (const { bytes, expected } of cases)
      expect(intFromLE(bytes).toString(16)).to.equal(expected);
  });
});
