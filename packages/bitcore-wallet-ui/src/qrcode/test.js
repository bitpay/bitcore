import BN from 'bn.js';
import { qrcode } from './qrcode';
var RIPEMD160 = require('crypto-js/ripemd160');
var SHA256 = require('crypto-js/sha256');

// secp256k1 parameters
var ecc_p = new BN(
  '0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F',
  16
);
var ecc_a = new BN(0);
var ecc_Gx = new BN(
  '079BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798',
  16
);
var ecc_Gy = new BN(
  '0483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8',
  16
);
var ecc_n = new BN(
  '0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141',
  16
);

var bn_0 = new BN(0);
var bn_1 = new BN(1);
var bn_2 = new BN(2);
var bn_3 = new BN(3);
var bn_58 = new BN(58);
var bn_255 = new BN(255);

function modinv(a, n) {
  var lm = new BN(1);
  var hm = new BN(0);
  var low = a.mod(n);
  var high = n;
  var ratio;
  var nm;
  var nnew;

  while (low.isNeg()) low = low.add(n);

  while (low.gt(bn_1)) {
    ratio = high.div(low);
    nm = hm.sub(lm.mul(ratio));
    nnew = high.sub(low.mul(ratio));
    hm = lm;
    high = low;
    lm = nm;
    low = nnew;
  }
  return lm.mod(n);
}

function ecAdd(ax, ay, bx, by) {
  var lambda = by
    .sub(ay)
    .mul(modinv(bx.sub(ax), ecc_p))
    .mod(ecc_p);
  var x = lambda
    .mul(lambda)
    .sub(ax)
    .sub(bx)
    .mod(ecc_p);
  var y = lambda
    .mul(ax.sub(x))
    .sub(ay)
    .mod(ecc_p);
  return [x, y];
}

function ecDouble(ax, ay) {
  var lambda = bn_3
    .mul(ax)
    .mul(ax)
    .add(ecc_a)
    .mul(modinv(bn_2.mul(ay), ecc_p))
    .mod(ecc_p);
  var x = lambda
    .mul(lambda)
    .sub(bn_2.mul(ax))
    .mod(ecc_p);
  var y = lambda
    .mul(ax.sub(x))
    .sub(ay)
    .mod(ecc_p);
  return [x, y];
}

// convert bigint to bool array (bits)
function bigintToBoolArray(bigint) {
  if (bigint.isNeg()) return [false];

  var values = [];
  while (bigint.gt(bn_0)) {
    values.push(bigint.isOdd());
    bigint = bigint.shrn(1);
  }
  return values.reverse();
}

function EccMultiply(gx, gy, scalar) {
  var qx = gx;
  var qy = gy;

  var bits = bigintToBoolArray(scalar);
  for (var i = 1; i < bits.length; ++i) {
    var ret = ecDouble(qx, qy);
    qx = ret[0];
    qy = ret[1];
    if (bits[i]) {
      var ret2 = ecAdd(qx, qy, gx, gy);
      qx = ret2[0];
      qy = ret2[1];
    }
  }
  console.log(ecc_p);
  while (qy.isNeg()) qy = qy.add(ecc_p);

  return [qx, qy];
}

// convert bigint to byte array (uint8)
function bigintToByteArray(bigint) {
  var ret = [];

  while (bigint.gt(bn_0)) {
    ret.push(bigint.and(bn_255).toNumber());
    bigint = bigint.shrn(8);
  }

  return ret;
}

function byteArrayToBigint(bytes) {
  var bigint = new BN(0);
  for (var i = 0; i < bytes.length; ++i) {
    bigint = bigint.shln(8);
    bigint = bigint.or(new BN(bytes[i]));
  }

  return bigint;
}

function get32SecureRandomBytes() {
  return window.crypto.getRandomValues(new Uint8Array(32));
}

var bip38generate_type = 'segwit';
var bip38generate_maxcount = 0;
var bip38generate_currentcount = 0;
var bip38generate_data = undefined;
var bip38generate_intervalID = 0;
var bip38generate_callback = undefined;
var bip38generate_progress = undefined;
var bip38generate_keypair = undefined;
var bip38generate_passpoint = undefined;
var bip38generate_ownersalt = undefined;
function bip38generate(password, count, type, progress, callback) {
  if (!password || password == '') {
    callback('Password must not be empty');
    return;
  }
  var ecc_Gx = new BN(
    '079BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798',
    16
  );
  var ecc_Gy = new BN(
    '0483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8',
    16
  );

  var ownersalt = get32SecureRandomBytes().slice(0, 8);

  /*
            var magic_bytes = [0x2C, 0xE9, 0xB3, 0xE1, 0xFF, 0x39, 0xE2, 0x53];
            var intermediate = [];
            intermediate.push.apply(intermediate, magic_bytes);
            intermediate.push.apply(intermediate, ownersalt);
            intermediate.push.apply(intermediate, passpoint);
            var checksum = SHA256(SHA256(intermediate, { asBytes: true }), { asBytes: true }).slice(0, 4);
            intermediate.push.apply(intermediate, checksum);
            */

  bip38generate_data = new Array(count);
  bip38generate_type = type;
  bip38generate_currentcount = 0;
  bip38generate_maxcount = count;
  bip38generate_callback = callback;
  bip38generate_progress = progress;
  bip38generate_ownersalt = ownersalt;
  bip38generate_intervalID = window.setInterval(bip38generate_timeout, 0);
}

function bip38generate_timeout() {
  if (bip38generate_currentcount < bip38generate_maxcount) {
    var seedb = get32SecureRandomBytes().slice(0, 24);

    var factorb = SHA256(SHA256(seedb, { asBytes: true }), { asBytes: true });

    var ecpoint = EccMultiply(
      bip38generate_keypair[0],
      bip38generate_keypair[1],
      byteArrayToBigint(factorb)
    );
    var generatedaddress = makeAddress(ecpoint);
    var address_with_type;
    switch (bip38generate_type) {
      case 'segwit':
        address_with_type = makeSegwitAddress(ecpoint);
        break;
      case 'bech32':
        address_with_type = makeBech32Address(ecpoint);
        break;
      case 'legacy':
        address_with_type = generatedaddress;
        break;
      default:
        break;
    }
    var addresshash = SHA256(SHA256(generatedaddress, { asBytes: true }), {
      asBytes: true
    }).slice(0, 4);

    var salt = [];
    salt.push.apply(salt, addresshash);
    salt.push.apply(salt, bip38generate_ownersalt);
    var AES_opts = {
      mode: new Crypto.mode.ECB(Crypto.pad.NoPadding),
      asBytes: true
    };

    var finalprivkey = [0x01, 0x43, 0x20];
    finalprivkey.push.apply(finalprivkey, addresshash);
    finalprivkey.push.apply(finalprivkey, bip38generate_ownersalt);
    finalprivkey.push.apply(
      finalprivkey,
      SHA256(SHA256(finalprivkey, { asBytes: true }), { asBytes: true }).slice(
        0,
        4
      )
    );

    bip38generate_data[bip38generate_currentcount] = [
      address_with_type,
      base58encode(finalprivkey)
    ];
    /*"" + (bip38generate_currentcount + 1) + ", \"" + address_with_type + "\", \"" + base58encode(finalprivkey) + "\"";*/
    ++bip38generate_currentcount;

    bip38generate_progress(bip38generate_currentcount, bip38generate_maxcount);
  } else {
    bip38generate_currentcount = 0;
    bip38generate_maxcount = 0;
    window.clearInterval(bip38generate_intervalID);
    bip38generate_intervalID = 0;
    bip38generate_keypair = undefined;
    bip38generate_passpoint = undefined;
    bip38generate_ownersalt = undefined;
    bip38generate_callback(bip38generate_data);
    bip38generate_callback = undefined;
    bip38generate_progress = undefined;
    bip38generate_data = undefined;
  }
}

function bip38decrypt_button() {
  document.getElementById('view_address_information').innerHTML =
    'Decrypting...';
  window.setTimeout(function() {
    var privkey = document.getElementById('view_address_privkey_textbox').value;
    var password = document.getElementById(
      'view_address_bip38_password_textbox'
    ).value;
    var result = bip38decrypt(privkey, password);

    if (typeof result == 'string') {
      document.getElementById('view_address_information').innerHTML =
        'Cannot decrypt address (' + result + ')';
      document.getElementById('view_address_segwitaddress').innerHTML = '';
      document.getElementById('view_address_bech32address').innerHTML = '';
      document.getElementById('view_address_legacyaddress').innerHTML = '';
      document.getElementById('view_address_segwitaddress_qr').innerHTML = '';
      document.getElementById('view_address_bech32address_qr').innerHTML = '';
      document.getElementById('view_address_legacyaddress_qr').innerHTML = '';
      document.getElementById('view_address_container').style =
        'display: none;';
      return;
    }

    var result2 = view_address_details_result(result[1]);
    if (typeof result2 == 'string') {
      document.getElementById('view_address_information').innerHTML =
        'Error decoding private key (' + result + ')';
      document.getElementById('view_address_segwitaddress').innerHTML = '';
      document.getElementById('view_address_bech32address').innerHTML = '';
      document.getElementById('view_address_legacyaddress').innerHTML = '';
      document.getElementById('view_address_segwitaddress_qr').innerHTML = '';
      document.getElementById('view_address_bech32address_qr').innerHTML = '';
      document.getElementById('view_address_legacyaddress_qr').innerHTML = '';
      document.getElementById('view_address_container').style =
        'display: none;';
      return;
    }

    document.getElementById('view_address_information').innerHTML =
      'Details for encrypted private key: <strong>' +
      privkey +
      '</strong><br /><br />Decrypted private key: <strong>' +
      result[1] +
      '</strong>';

    document.getElementById('view_address_segwitaddress').innerHTML =
      'Segwit address: ' + result2[0];
    document.getElementById('view_address_bech32address').innerHTML =
      'Segwit (bech32) address: ' + result2[1];
    document.getElementById('view_address_legacyaddress').innerHTML =
      'Legacy address: ' + result2[2];

    var qr = qrcode(0, qrErrorCorrectionLevel);
    qr.addData(result2[0]);
    qr.make();
    document.getElementById(
      'view_address_segwitaddress_qr'
    ).innerHTML = qr.createImgTag(4, 8);

    qr = qrcode(0, qrErrorCorrectionLevel);
    qr.addData(result2[1].toUpperCase(), 'Alphanumeric');
    qr.make();
    document.getElementById(
      'view_address_bech32address_qr'
    ).innerHTML = qr.createImgTag(4, 8);

    qr = qrcode(0, qrErrorCorrectionLevel);
    qr.addData(result2[2]);
    qr.make();
    document.getElementById(
      'view_address_legacyaddress_qr'
    ).innerHTML = qr.createImgTag(4, 8);

    document.getElementById('view_address_container').style =
      'display: table; border: 2px solid #bbbbbb; border-radius: 3px;';
  }, 0);
}

function bip38decrypt(privkey, password) {
  if (!password || password === '') return 'password must not be empty';

  var newstring = privkey
    .split('')
    .reverse()
    .join('');
  for (var i = 0; i < privkey.length; ++i) {
    if (privkey[i] == base58Characters[0])
      newstring = newstring.substr(0, newstring.length - 1);
    else break;
  }

  var bigint = new BN(0);
  for (var i = newstring.length - 1; i >= 0; --i)
    bigint = bigint.mul(bn_58).add(new BN(base58CharsIndices[newstring[i]]));

  var bytes = bigintToByteArray(bigint);

  if (bytes.length != 43) return 'invalid length';

  bytes.reverse();

  var checksum = bytes.slice(bytes.length - 4, bytes.length);
  bytes.splice(bytes.length - 4, 4);
  var sha_result = SHA256(SHA256(bytes, { asBytes: true }), { asBytes: true });

  for (var i = 0; i < 4; ++i) {
    if (sha_result[i] != checksum[i]) return 'invalid checksum';
  }

  bytes.shift();

  var AES_opts = {
    mode: new Crypto.mode.ECB(Crypto.pad.NoPadding),
    asBytes: true
  };

  if (bytes[0] == 0x43) {
    if ((bytes[1] & 0x20) == 0)
      return 'only compressed private keys are supported';

    if (typeof password == 'number') return 1; // dummy return value, only for checking if the private key is in the correct format

    var ownersalt = bytes.slice(6, 14);
    var keypair = getECCKeypair(bigint);

    var bytes_public_x = bigintToByteArray(keypair[0]);
    while (bytes_public_x.length < 32) bytes_public_x.push(0);

    var passpoint = [];
    passpoint.push.apply(passpoint, bytes_public_x);

    if (keypair[1].isOdd()) passpoint.push(0x03);
    else passpoint.push(0x02);

    passpoint.reverse();
    var encryptedpart2 = bytes.slice(22, 38);
    var addresshash = bytes.slice(2, 14);
    var encryptedpart1 = bytes.slice(14, 22);
  } else if (bytes[0] == 0x42)
    return 'only EC multiplied key decryption is supported';
  else return 'invalid byte at EC multiply flag';
}

var base58Characters =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
var base58CharsIndices = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  A: 9,
  B: 10,
  C: 11,
  D: 12,
  E: 13,
  F: 14,
  G: 15,
  H: 16,
  J: 17,
  K: 18,
  L: 19,
  M: 20,
  N: 21,
  P: 22,
  Q: 23,
  R: 24,
  S: 25,
  T: 26,
  U: 27,
  V: 28,
  W: 29,
  X: 30,
  Y: 31,
  Z: 32,
  a: 33,
  b: 34,
  c: 35,
  d: 36,
  e: 37,
  f: 38,
  g: 39,
  h: 40,
  i: 41,
  j: 42,
  k: 43,
  m: 44,
  n: 45,
  o: 46,
  p: 47,
  q: 48,
  r: 49,
  s: 50,
  t: 51,
  u: 52,
  v: 53,
  w: 54,
  x: 55,
  y: 56,
  z: 57
};

function base58encode(bytes) {
  var leading_zeroes = 0;
  while (
    bytes[leading_zeroes] === 0 // count leading zeroes
  )
    leading_zeroes++;

  var bigint = new BN(0);
  // convert bytes to bigint
  for (var i = 0; i < bytes.length; ++i) {
    bigint = bigint.shln(8);
    bigint = bigint.or(new BN(bytes[i]));
  }

  bytes.reverse();

  var ret = '';
  while (bigint.gt(bn_0)) {
    // get base58 character
    var remainder = bigint.mod(bn_58);
    bigint = bigint.div(bn_58);
    ret += base58Characters[remainder.toNumber()];
  }

  for (
    var i = 0;
    i < leading_zeroes;
    ++i // add padding if necessary
  )
    ret += base58Characters[0];

  return ret
    .split('')
    .reverse()
    .join('');
}

// get ECC public key from bigint
function getECCKeypair(val) {
  if (val.isZero() || val.gte(ecc_n)) {
    console.log('invalid value');
    return;
  }

  return EccMultiply(ecc_Gx, ecc_Gy, val);
}

// make legacy address from public key
function makeAddress(keypair) {
  var key_bytes = [];

  var bytes_public_x = bigintToByteArray(keypair[0]);
  while (bytes_public_x.length < 32) bytes_public_x.push(0);

  key_bytes.push.apply(key_bytes, bytes_public_x);

  if (keypair[1].isOdd()) key_bytes.push(0x03);
  else key_bytes.push(0x02);

  key_bytes.reverse();
  var sha_result_1 = SHA256(key_bytes, { asBytes: true });
  var ripemd_result_2 = RIPEMD160(sha_result_1, { asBytes: true });
  var ripemd_extended = [0];
  ripemd_extended.push.apply(ripemd_extended, ripemd_result_2);
  var sha_result_3 = SHA256(ripemd_extended, { asBytes: true });
  var sha_result_4 = SHA256(sha_result_3, { asBytes: true });
  ripemd_extended.push.apply(ripemd_extended, sha_result_4);

  return base58encode(ripemd_extended);
}

// make segwit address from public key
function makeSegwitAddress(keypair) {
  var key_bytes = [];

  var bytes_public_x = bigintToByteArray(keypair[0]);
  while (bytes_public_x.length < 32) bytes_public_x.push(0);

  key_bytes.push.apply(key_bytes, bytes_public_x);

  if (keypair[1].isOdd()) key_bytes.push(0x03);
  else key_bytes.push(0x02);

  key_bytes.reverse();
  var sha_result_1 = SHA256(key_bytes, { asBytes: true });
  var keyhash = RIPEMD160(sha_result_1, { asBytes: true });

  var redeemscript = [0x00, 0x14];
  redeemscript.push.apply(redeemscript, keyhash);

  var redeemscripthash = [0x05];
  redeemscripthash.push.apply(
    redeemscripthash,
    RIPEMD160(SHA256(redeemscript, { asBytes: true }), { asBytes: true })
  );
  console.log(redeemscripthash);

  redeemscripthash.push.apply(
    redeemscripthash,
    SHA256(SHA256(redeemscripthash, { asBytes: true }), {
      asBytes: true
    })
  );
  console.log(redeemscripthash);
  return base58encode(redeemscripthash);
}

var bech32Chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32HrpExpand(hrp) {
  var ret = [];
  for (var i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) >> 5);

  ret.push(0);

  for (var i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) & 0x1f);

  return ret;
}

function bech32Polymod(values) {
  var GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  var chk = 1;

  for (var i = 0; i < values.length; ++i) {
    var b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ values[i];

    for (var j = 0; j < 5; ++j) {
      if ((b >> j) & 1) chk ^= GEN[j];
    }
  }

  return chk;
}

function bech32CreateChecksum(hrp, data) {
  var asd = bech32HrpExpand(hrp);
  asd.push.apply(asd, data);
  asd.push.apply(asd, [0, 0, 0, 0, 0, 0]);

  var polymod = bech32Polymod(asd) ^ 1;

  let ret = [];
  for (var i = 0; i < 6; ++i) ret.push((polymod >> (5 * (5 - i))) & 31);

  return ret;
}

// create bech32 address from public key
function makeBech32Address(keypair) {
  var key_bytes = [];

  var bytes_public_x = bigintToByteArray(keypair[0]);
  while (bytes_public_x.length < 32) bytes_public_x.push(0);
  key_bytes.push.apply(key_bytes, bytes_public_x);

  if (keypair[1].isOdd()) key_bytes.push(0x03);
  else key_bytes.push(0x02);

  key_bytes.reverse();
  var sha_result_1 = SHA256(key_bytes, { asBytes: true });
  var keyhash = RIPEMD160(sha_result_1, { asBytes: true });

  var redeemscript = [0x00, 0x14];
  redeemscript.push.apply(redeemscript, keyhash);

  var value = 0;
  var bits = 0;

  var result = [0];
  for (var i = 0; i < 20; ++i) {
    value = ((value << 8) | keyhash[i]) & 0xffffff;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      result.push((value >> bits) & 0x1f);
    }
  }

  var address = 'bc1';
  for (var i = 0; i < result.length; ++i) address += bech32Chars[result[i]];

  var checksum = bech32CreateChecksum('bc', result);
  for (var i = 0; i < checksum.length; ++i) address += bech32Chars[checksum[i]];

  return address;
}

// create base58 encoded private key from bigint
function makePrivateKey(bigint) {
  var privkey = [];
  privkey.push(0x01);

  var temp = bigintToByteArray(bigint);
  while (temp.length < 32) temp.push(0);

  privkey.push.apply(privkey, temp);
  privkey.push(0x80);
  privkey.reverse();
  privkey.push.apply(
    privkey,
    SHA256(SHA256(privkey, { asBytes: true }), {
      asBytes: true
    })
  );
  console.log(privkey);
  return base58encode(privkey);
}

var addressType = 'bech32';
// set generated address type (single address)
export function setAddressType(type) {
  addressType = type;
}

var qrErrorCorrectionLevel = 'H';
// set qr code error correction level (single address)
export function setQRErrorCorrectionLevel(level) {
  qrErrorCorrectionLevel = level;

  // update qr codes
  var privkey = document.getElementById('privkey_privkey').innerHTML;
  var qr = qrcode(0, qrErrorCorrectionLevel);
  qr.addData(privkey);
  qr.make();

  document.getElementById('privkey_qr').src = qr.createDataURL(6, 12);

  var address = document.getElementById('address_address').innerHTML;
  if (addressType === 'bech32')
    qr.addData(address.toUpperCase(), 'Alphanumeric');
  else qr.addData(address);

  qr.make();

  document.getElementById('address_qr').src = qr.createDataURL(6, 12);
}

// generate one address (single address)
export function generate_address() {
  var bytes = get32SecureRandomBytes();

  var result = generate_address_result(
    bytes,
    addressType,
    true,
    qrErrorCorrectionLevel
  );

  document.getElementById('address_address').innerHTML = result[3];

  var qr_div_address = document.getElementById('address_qr');
  qr_div_address.src = result[4].createDataURL(6, 12);
  qr_div_address.style =
    'display:block; margin-left: auto; margin-right: auto;';
}

// generates address from bytes, then returns the address and qr code if necessary
function generate_address_result(
  bytes,
  type,
  generateQR,
  paramQRErrorCorrectionLevel
) {
  var bigint = new BN(0);
  console.log(bigint);
  for (var j = 0; j < bytes.length; ++j) {
    bigint = bigint.shln(8);
    bigint = bigint.or(new BN(bytes[j]));
  }
  // var keypair =
  //   '028f002c55c96f95c51a5dbd45e69bb1bab59ae50a257281b7aeb4d4921a6e34c2';
  var keypair = getECCKeypair(bigint);
  var privkey =
    '2ac05b74db0570468f7684644a6b09c1e963b5a304989b0e14d213a8269cb409';
  // var privkey = makePrivateKey(bigint);

  var address;
  var return_address_type;
  switch (type) {
    case 'segwit':
      return_address_type = 'Segwit address:';
      address = makeSegwitAddress(keypair);
      break;
    case 'bech32':
      return_address_type = 'Segwit (bech32) address:';
      address = makeBech32Address(keypair);
      break;
    case 'legacy':
      return_address_type = 'Legacy address:';
      address = makeAddress(keypair);
      break;
    default:
      break;
  }

  if (generateQR) {
    var qr = qrcode(0, paramQRErrorCorrectionLevel);
    qr.addData(privkey);
    qr.make();
    var return_privkey_qr = qr;

    qr = qrcode(0, paramQRErrorCorrectionLevel);
    if (type === 'bech32') qr.addData(address.toUpperCase(), 'Alphanumeric');
    else qr.addData(address);

    qr.make();
    var return_address_qr = qr;

    return [
      privkey,
      return_privkey_qr,
      return_address_type,
      address,
      return_address_qr
    ];
  }
  return [privkey, return_address_type, address];
}

var bulkTextarea;

// returns addresses generated from the private key
function view_address_details_result(privkey) {
  if (privkey.length === 58 && privkey[0] === '6' && privkey[1] === 'P') {
    // maybe a bip38 encrypted key
    var bip38_result = bip38decrypt(privkey, 1);
    if (bip38_result === 1) {
      document.getElementById('bip38_decrypt_div').style.display = 'block';
      return 1;
    } else if (typeof bip38_result == 'string') return bip38_result;
    else document.getElementById('bip38_decrypt_div').style.display = 'none';
  } else document.getElementById('bip38_decrypt_div').style.display = 'none';

  var newstring = privkey
    .split('')
    .reverse()
    .join('');
  for (var i = 0; i < privkey.length; ++i) {
    if (privkey[i] === base58Characters[0])
      newstring = newstring.substr(0, newstring.length - 1);
    else break;
  }

  var bigint = new BN(0);
  for (var i = newstring.length - 1; i >= 0; --i)
    bigint = bigint.mul(bn_58).add(new BN(base58CharsIndices[newstring[i]]));

  var bytes = bigintToByteArray(bigint);
  if (bytes[bytes.length - 1] === 0) bytes.pop();

  bytes.reverse();

  var checksum = bytes.slice(bytes.length - 4, bytes.length);
  bytes.splice(bytes.length - 4, 4);
  var sha_result = SHA256(SHA256(bytes, { asBytes: true }), { asBytes: true });

  for (var i = 0; i < 4; ++i) {
    if (sha_result[i] !== checksum[i]) return 'invalid checksum';
  }

  if (bytes.pop() !== 1)
    return "only compressed private keys are supported, they start with 'L' or 'K'";

  bytes.reverse();
  bytes.pop();

  if (bytes.length !== 32) return 'invalid length';

  bigint = new BN(0);
  for (var j = bytes.length - 1; j >= 0; --j) {
    bigint = bigint.shln(8);
    bigint = bigint.or(new BN(bytes[j]));
  }

  var keypair = getECCKeypair(bigint);

  var privkey2 = makePrivateKey(bigint);
  if (privkey !== privkey2) return 'cannot decode private key';

  return [
    makeSegwitAddress(keypair),
    makeBech32Address(keypair),
    makeAddress(keypair)
  ];
}

// shows addresses generated from the given private key
function view_address_details() {
  var privkey = document
    .getElementById('view_address_privkey_textbox')
    .value.trim();
  if (privkey === '') return;

  var result = view_address_details_result(privkey);
  if (typeof result == 'string') {
    document.getElementById('view_address_information').innerHTML =
      'Invalid private key (' + result + ')';
    document.getElementById('view_address_segwitaddress').innerHTML = '';
    document.getElementById('view_address_bech32address').innerHTML = '';
    document.getElementById('view_address_legacyaddress').innerHTML = '';
    document.getElementById('view_address_segwitaddress_qr').innerHTML = '';
    document.getElementById('view_address_bech32address_qr').innerHTML = '';
    document.getElementById('view_address_legacyaddress_qr').innerHTML = '';
    document.getElementById('view_address_container').style = 'display: none;';
    return;
  } else if (typeof result == 'number' && result == 1) {
    //bip38 encrypted
    document.getElementById('view_address_information').innerHTML = '';
    document.getElementById('view_address_segwitaddress').innerHTML = '';
    document.getElementById('view_address_bech32address').innerHTML = '';
    document.getElementById('view_address_legacyaddress').innerHTML = '';
    document.getElementById('view_address_segwitaddress_qr').innerHTML = '';
    document.getElementById('view_address_bech32address_qr').innerHTML = '';
    document.getElementById('view_address_legacyaddress_qr').innerHTML = '';
    document.getElementById('view_address_container').style = 'display: none;';
    return;
  }

  document.getElementById('view_address_information').innerHTML =
    'Details for private key: <strong>' + privkey + '</strong>';
  document.getElementById('view_address_segwitaddress').innerHTML =
    'Segwit address: ' + result[0];
  document.getElementById('view_address_bech32address').innerHTML =
    'Segwit (bech32) address: ' + result[1];
  document.getElementById('view_address_legacyaddress').innerHTML =
    'Legacy address: ' + result[2];

  var qr = qrcode(0, qrErrorCorrectionLevel);
  qr.addData(result[0]);
  qr.make();
  document.getElementById(
    'view_address_segwitaddress_qr'
  ).innerHTML = qr.createImgTag(4, 8);

  qr = qrcode(0, qrErrorCorrectionLevel);
  qr.addData(result[1].toUpperCase(), 'Alphanumeric');
  qr.make();
  document.getElementById(
    'view_address_bech32address_qr'
  ).innerHTML = qr.createImgTag(4, 8);

  qr = qrcode(0, qrErrorCorrectionLevel);
  qr.addData(result[2]);
  qr.make();
  document.getElementById(
    'view_address_legacyaddress_qr'
  ).innerHTML = qr.createImgTag(4, 8);

  document.getElementById('view_address_container').style =
    'display: table; border: 2px solid #bbbbbb; border-radius: 3px;';
}

var bulkAddressType = 'bech32';
// set address type for bulk generate
function setBulkAddressType(type, event) {
  bulkAddressType = type;
}

var bulkArray = undefined;
var bulkCount = 0;
var bulkIntervalID = 0;
// start bulk generate
function bulk_generate() {
  if (bulkArray) return;

  var result = [];

  var num = Number.parseInt(document.getElementById('bulk_count').value);
  if (isNaN(num)) {
    bulkTextarea.innerHTML = 'Enter a number';
    return;
  }
  if (num < 1) {
    bulkTextarea.innerHTML = 'Number must be greater than zero';
    return;
  }
  if (num > 1000) {
    bulkTextarea.innerHTML = 'Number must be 1000 at most';
    return;
  }

  document.getElementById('bulk_radio_type_segwit').disabled = true;
  document.getElementById('bulk_radio_type_bech32').disabled = true;
  document.getElementById('bulk_radio_type_legacy').disabled = true;

  if (document.getElementById('bip38enabled_bulk').checked) {
    bulkTextarea.innerHTML = 'Generating initial values';
    bulkArray = [];
    window.setTimeout(function() {
      bip38generate(
        document.getElementById('bip38_password_box_bulk').value,
        num,
        bulkAddressType,
        function(counter, maxcount) {
          bulkTextarea.innerHTML = 'Generating: ' + counter + '/' + maxcount;
        },
        function(data) {
          if (typeof data == 'string') bulkTextarea.innerHTML = data;
          else {
            var temp = new Array(data.length);
            for (var i = 0; i < data.length; ++i)
              temp[i] =
                '' + (i + 1) + ', "' + data[i][0] + '", "' + data[i][1] + '"';

            bulkTextarea.innerHTML = temp.join('&#13;&#10;');
          }

          document.getElementById('bulk_radio_type_segwit').disabled = false;
          document.getElementById('bulk_radio_type_bech32').disabled = false;
          document.getElementById('bulk_radio_type_legacy').disabled = false;
          bulkArray = undefined;
        }
      );
    }, 0);
    return;
  }
  bulkCount = num;
  bulkCurrentCount = 0;
  bulkArray = new Array(bulkCount);

  bulkIntervalID = window.setInterval(bulk_generate_timeout, 0);
}

var bulkCurrentCount = 0;
// generate 1 address periodically, so the page won't freeze while generating
function bulk_generate_timeout() {
  if (bulkCurrentCount < bulkCount) {
    var bytes = get32SecureRandomBytes();
    var data = generate_address_result(bytes, bulkAddressType, false);
    bulkArray[bulkCurrentCount] =
      '' + (bulkCurrentCount + 1) + ', "' + data[2] + '", "' + data[0] + '"';
    ++bulkCurrentCount;
    bulkTextarea.innerHTML =
      'Generating: ' + bulkCurrentCount + '/' + bulkCount;
  } else {
    window.clearInterval(bulkIntervalID);
    bulkCount = 0;
    bulkCurrentCount = 0;
    bulkTextarea.innerHTML = bulkArray.join('&#13;&#10;');
    bulkArray = undefined;

    document.getElementById('bulk_radio_type_segwit').disabled = false;
    document.getElementById('bulk_radio_type_bech32').disabled = false;
    document.getElementById('bulk_radio_type_legacy').disabled = false;
  }
}

// split text into given number of rows
function splitText(text, rows) {
  var len = text.length;
  var textarray = [];
  var lineLength = Math.ceil(len / rows);

  var i = 0;
  while (i < len) {
    textarray.push(text.substr(i, lineLength));
    i += lineLength;
  }

  return textarray.join('<br />');
}

// split text into rows, with each row having a max length
function splitTextLength(text, length) {
  if (length == 0) return text;

  var len = text.length;
  var textarray = [];

  var i = 0;
  while (i < len) {
    textarray.push(text.substr(i, length));
    i += length;
  }

  return textarray.join('<br />');
}
