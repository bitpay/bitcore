'use strict';
// Copyright (c) 2018 Matias Alejo Garcia
// Copyright (c) 2017 Emilio Almansi
// Copyright (c) 2017 Pieter Wuille
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/**
 * Converts an array of integers made up of `from` bits into an
 * array of integers made up of `to` bits. The output array is
 * zero-padded if necessary, unless strict mode is true.
 * Original by Pieter Wuille: https://github.com/sipa/bech32.
 *
 * @param {Array} data Array of integers made up of `from` bits.
 * @param {number} from Length in bits of elements in the input array.
 * @param {number} to Length in bits of elements in the output array.
 * @param {bool} strict Require the conversion to be completed without padding.
 */
var $ = require('./preconditions');

module.exports = function(data, from, to, strict){
  strict = strict || false;
  var accumulator = 0;
  var bits = 0;
  var result = [];
  var mask = (1 << to) - 1;
  for (var i=0; i<data.length; i++) {
    var value = data[i];
    $.checkArgument(!(value < 0 || (value >> from) !== 0), 'value ' + value);

    accumulator = (accumulator << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      result.push((accumulator >> bits) & mask);
    }
  }
  if (!strict) {
    if (bits > 0) {
      result.push((accumulator << (to - bits)) & mask);
    }
  } else {
   $.checkState(!(bits >= from || ((accumulator << (to - bits)) & mask)),  'Conversion requires padding but strict mode was used');
  }
  return result;
};
