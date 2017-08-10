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

module.exports = {
  revHex,
  calcBlockReward,
};

