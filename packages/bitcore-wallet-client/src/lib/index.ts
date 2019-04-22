import { Verifier } from 'lib/verifier';
import { Utils } from 'lib/common/utils';
import { sjcl } from 'sjcl';
import { Bitcore } from 'bitcore-lib';
import { BitcoreCash } from 'bitcore-lib-cash';

const client = {
  Verifier,
  Utils,
  sjcl,
  // Expose bitcore
  Bitcore,
  BitcoreCash
}

module.exports = client;
