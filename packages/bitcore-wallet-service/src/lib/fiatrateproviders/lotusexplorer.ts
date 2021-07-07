const ELECTRICITY_RATE = 0.1;
const MINER_MARGIN = 1;
const MINING_EFFICIENCY = 3.4;

interface LotusData {
    hashrate: string | number; 
    difficulty: string | number; 
}

module.exports = {
  name: 'LotusExplorer',
  url: 'https://explorer.givelotus.org/ext/summary',
  parseFn(raw: { data: LotusData[]; }) {
    const currentDiff: number = +raw.data[0].difficulty;
    const hashRate: number = +raw.data[0].hashrate;
    const currentMinerReward = Math.round((Math.log2(currentDiff / 16) + 1) * 130 * 1000000) / 1000000;
    const dailyElectricityCost = (((hashRate / MINING_EFFICIENCY) * 24) / 1000) * ELECTRICITY_RATE;
    const lotusPrice = (dailyElectricityCost * (1 + MINER_MARGIN)) / currentMinerReward / 30 / 24;
    return [{ code: 'USD', value: Math.round(lotusPrice * 1000000) / 1000000 }];
  }
};
