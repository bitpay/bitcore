var nop = function() {
  return 'v01234567890123456789';
};

define('base58-native', {
  base58Check: {
    encode: nop,
    decode: nop
  }
});
