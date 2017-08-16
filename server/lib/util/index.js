function revHex(hex) {
  let rev = '';
  for (let i = 0; i < hex.length; i += 2) {
    rev = hex.slice(i, i + 2) + rev;
  }

  return rev;
}

function calcBlockReward(height) {
  let halvenings = Math.floor(height / 210000);
  let reward     = 50 * 1e8;
  if (halvenings >= 64) {
    return 0;
  }

  while (halvenings > 0) {
    halvenings -= 1;
    reward /= 2;
  }
  return reward;
}

function is64HexString(value) {
  return /^[0-9a-f]{64}$/i.test(value);
}

function isBitcoinAddress(value) {
  return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(value);
}

module.exports = {
  revHex,
  calcBlockReward,
  isBlockHash: is64HexString,
  isTxid: is64HexString,
  isBitcoinAddress,
};

