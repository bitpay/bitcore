MSG = {
  TX: 1,
  BLOCK: 2,
  FILTERED_BLOCK: 3,
};

MSG.to_str = function(t) {
  switch (t) {
    case MSG.TX:
      return 'transaction';
    case MSG.BLOCK:
      return 'block';
    case MSG.FILTERED_BLOCK:
      return 'filtered block';
    default:
      return 'unknown';
  }
}

exports.MSG = MSG;
