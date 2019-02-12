import './AES256';
import { RIPEMD160, SHA256 } from './SHA256';
import BN from './BigNumber';
import { qrcode } from './QR';
import './Scrypt';

var randomnessBytes = 43 d2 3b f4 96 70 3d 67 8d f0 16 8a 48 c5 a0 3f
56 28 8e 65 d4 5a 12 71 70 5d 81 86 ff 65 29 ed ;

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
var base58Characters =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

var bn_0 = new BN(0);
var bn_1 = new BN(1);
var bn_2 = new BN(2);
var bn_3 = new BN(3);
var bn_58 = new BN(58);
var bn_255 = new BN(255);

var addressType = 'segwit';
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
  document.getElementById('privkey_privkey').innerHTML = result[0];
  var qr_div_privkey = document.getElementById('privkey_qr');
  qr_div_privkey.src = result[1].createDataURL(6, 12);
  qr_div_privkey.style =
    'display:block; margin-left: auto; margin-right: auto;';

  document.getElementById('address_address').innerHTML = result[3];

  var qr_div_address = document.getElementById('address_qr');
  qr_div_address.src = result[4].createDataURL(6, 12);
  qr_div_address.style =
    'display:block; margin-left: auto; margin-right: auto;';

  document.getElementById('address_div').style = 'display: table;';
}

// generates address from bytes, then returns the address and qr code if necessary
function generate_address_result(
  bytes,
  type,
  generateQR,
  paramQRErrorCorrectionLevel
) {
  var bigint = new BN(0);
  for (var j = 0; j < bytes.length; ++j) {
    bigint = bigint.shln(8);
    bigint = bigint.or(new BN(bytes[j]));
  }

  var keypair = getECCKeypair(bigint);
  var privkey = makePrivateKey(bigint);

  var address;
  var return_address_type;
  switch (type) {
    case 'segwit':
      return_address_type = 'Segwit address:';
      address = makeSegwitAddress(keypair);
      break;
    case 'legacy':
      return_address_type = 'Legacy address:';
      address = makeAddress(keypair);
      break;
    default:
      return;
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

// convert bigint to byte array (uint8)
function bigintToByteArray(bigint) {
  var ret = [];

  while (bigint.gt(bn_0)) {
    ret.push(bigint.and(bn_255).toNumber());
    bigint = bigint.shrn(8);
  }

  return ret;
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
    SHA256(SHA256(privkey, { asBytes: true }), { asBytes: true }).slice(0, 4)
  );
  return base58encode(privkey);
}

// get ECC public key from bigint
function getECCKeypair(val) {
  if (val.isZero() || val.gte(ecc_n)) {
    console.log('invalid value');
    return;
  }

  return EccMultiply(ecc_Gx, ecc_Gy, val);
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

  while (qy.isNeg()) qy = qy.add(ecc_p);

  return [qx, qy];
}

function base58encode(bytes) {
  var leading_zeroes = 0;
  while (
    bytes[leading_zeroes] === 0 // count leading zeroes
  )
    ++leading_zeroes;

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
  ripemd_extended.push.apply(ripemd_extended, sha_result_4.slice(0, 4));

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

  redeemscripthash.push.apply(
    redeemscripthash,
    SHA256(SHA256(redeemscripthash, { asBytes: true }), {
      asBytes: true
    }).slice(0, 4)
  );

  return base58encode(redeemscripthash);
}
