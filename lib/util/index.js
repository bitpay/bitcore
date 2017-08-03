function revHex(hex) {
  let rev = '';
  for (let i = 0; i < hex.length; i += 2) {
    rev = hex.slice(i, i + 2) + rev;
  }

  return rev;
}

module.exports = {
  revHex,
};
