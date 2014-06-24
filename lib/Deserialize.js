exports.intFromCompact = function(c) {
  var bytes = ((c >>> 24) & 0xff) >>> 0;
  var v = ((c & 0xffffff) << (8 * (bytes - 3))) >>> 0;
  return v;
}
