/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { BN, Utils } = require('../');
const ellipticUtils = require('../../bitcore-lib/node_modules/elliptic/lib/elliptic/utils');
const EllipticBN = require('../../bitcore-lib/node_modules/bn.js');
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
    if (Number.isNaN(expected[i]))
      expect(Number.isNaN(actual[i])).to.equal(true);
    else
      expect(actual[i]).to.equal(expected[i]);
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

function jsfToBN(jsf) {
  return nafToBN(jsf);
}

function localBN(hex) {
  return new BN(hex, 16);
}

function referenceBN(hex) {
  return new EllipticBN(hex, 16);
}

describe('Utils.assert', function () {
  const falsyValues = [false, 0, '', null, undefined];
  for (const val of falsyValues) {
    it('throws for falsy value ' + JSON.stringify(val), function () {
      expect(function () { assert(val); }).to.throw(Error, 'Assertion failed');
    });
  }

  it('throws with custom message', function () {
    expect(function () { assert(false, 'my error'); }).to.throw(Error, 'my error');
  });

  it('does not throw for truthy values', function () {
    expect(function () { assert(true); }).to.not.throw();
    expect(function () { assert(1); }).to.not.throw();
    expect(function () { assert('yes'); }).to.not.throw();
  });
});

describe('Utils.toArray', function () {
  const stringCases = [
    ['abc'],
    ['hello'],
    ['a'],
    ['\u1234234'],
    [''],
    [null],
    [undefined]
  ];

  for (const pair of stringCases) {
    const input = pair[0];
    it('matches elliptic for string input ' + JSON.stringify(input), function () {
      expectArrayWithNaN(toArray(input), ellipticUtils.toArray(input));
    });
  }

  const hexCases = [
    ['deadbeef'],
    ['00ff01'],
    ['DEADBEEF'],
    ['abc'],
    ['zz'],
    ['1g'],
    ['12 34'],
    ['12:34'],
    ['f'],
    ['']
  ];

  for (const pair of hexCases) {
    const input = pair[0];
    it('matches elliptic for hex input ' + JSON.stringify(input), function () {
      expectArrayWithNaN(toArray(input, 'hex'), ellipticUtils.toArray(input, 'hex'));
    });
  }

  it('copies arrays like elliptic', function () {
    const input = [1, 2, 3];
    const result = toArray(input);

    expect(result).to.deep.equal(ellipticUtils.toArray(input));
    expect(result).to.not.equal(input);
  });

  it('copies array-like inputs like elliptic', function () {
    const input = Buffer.from([1, 2, 255]);
    expect(toArray(input)).to.deep.equal(ellipticUtils.toArray(input));
  });
});

describe('Utils.zero2', function () {
  const cases = ['0', '1', '01', '100', '-1'];

  for (const word of cases) {
    it('matches elliptic for ' + JSON.stringify(word), function () {
      expect(zero2(word)).to.equal(ellipticUtils.zero2(word));
    });
  }
});

describe('Utils.toHex', function () {
  const cases = [
    [],
    [0, 1, 2, 3],
    [15, 16, 255],
    [256, 512],
    [-1, -16]
  ];

  for (const arr of cases) {
    it('matches elliptic for ' + JSON.stringify(arr), function () {
      expect(toHex(arr)).to.equal(ellipticUtils.toHex(arr));
    });
  }
});

describe('Utils.encode', function () {
  const hexCases = [
    [],
    [0, 1, 255],
    [10, 11, 12],
    [128, 64, 32],
    [256, 512],
    [-1, -16]
  ];

  for (const arr of hexCases) {
    it('matches elliptic hex encoding for ' + JSON.stringify(arr), function () {
      expect(encode(arr, 'hex')).to.equal(ellipticUtils.encode(arr, 'hex'));
    });
  }

  const passthroughEncodings = ['binary', 'utf8', 'base64', undefined, null];
  for (const enc of passthroughEncodings) {
    it('returns same reference for encoding ' + JSON.stringify(enc), function () {
      const input = [1, 2, 3];
      expect(encode(input, enc)).to.equal(input);
    });
  }
});

describe('Utils.getNAF', function () {
  const scalarHex = [
    '0', '1', '2', '3', '7', '8', 'f', '10', '1f', '7f',
    '80', 'ff', '100', 'deadbeef'
  ];
  const windowSet = [1, 2, 3, 4, 5];

  for (const hex of scalarHex) {
    for (const w of windowSet) {
      const bits = Math.max(localBN(hex).bitLength(), 8);

      it('matches elliptic getNAF(' + hex + ', w=' + w + ')', function () {
        const actual = getNAF(localBN(hex), w, bits);
        const expected = ellipticUtils.getNAF(referenceBN(hex), w, bits);
        expect(actual).to.deep.equal(expected);
      });

      it('reconstructs getNAF(' + hex + ', w=' + w + ') numerically', function () {
        const k = localBN(hex);
        expectBNValue(nafToBN(getNAF(k, w, bits)), k);
      });
    }
  }
});

describe('Utils.getJSF', function () {
  const pairHex = [
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

  for (const pair of pairHex) {
    const a = pair[0];
    const b = pair[1];

    it('matches elliptic getJSF(' + a + ', ' + b + ')', function () {
      const actual = getJSF(localBN(a), localBN(b));
      const expected = ellipticUtils.getJSF(referenceBN(a), referenceBN(b));
      expect(actual).to.deep.equal(expected);
    });

    it('reconstructs getJSF(' + a + ', ' + b + ') numerically', function () {
      const jsf = getJSF(localBN(a), localBN(b));
      expectBNValue(jsfToBN(jsf[0]), localBN(a));
      expectBNValue(jsfToBN(jsf[1]), localBN(b));
    });

    it('emits JSF digits in {-1, 0, 1} for ' + a + ', ' + b, function () {
      const jsf = getJSF(localBN(a), localBN(b));
      for (let i = 0; i < jsf.length; i++) {
        for (let j = 0; j < jsf[i].length; j++)
          expect(Math.abs(jsf[i][j])).to.be.at.most(1);
      }
    });
  }
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
  const stringCases = ['deadbeef', 'abc', 'zz', '12 34'];

  for (const input of stringCases) {
    it('matches elliptic for string input ' + JSON.stringify(input), function () {
      expectArrayWithNaN(parseBytes(input), ellipticUtils.parseBytes(input));
    });
  }

  it('returns non-string input unchanged like elliptic', function () {
    const input = [1, 2, 3];
    expect(parseBytes(input)).to.equal(input);
  });
});

describe('Utils.intFromLE', function () {
  const cases = [
    [],
    [1],
    [1, 2, 3],
    [0xff, 0x00, 0x10]
  ];

  for (const bytes of cases) {
    it('matches elliptic for ' + JSON.stringify(bytes), function () {
      expect(intFromLE(bytes).toString(16))
        .to.equal(ellipticUtils.intFromLE(bytes).toString(16));
    });
  }
});
