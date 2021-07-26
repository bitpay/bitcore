const Config = require('../../config');

const ELECTRICITY_RATE = Config.fiatRateServiceOpts.lotusProvider.electricityRate;
const MINER_MARGIN = Config.fiatRateServiceOpts.lotusProvider.minerMargin;
const MINING_EFFICIENCY = Config.fiatRateServiceOpts.lotusProvider.miningEfficiency;

interface LotusData {
  hashrate: string | number;
  difficulty: string | number;
}

module.exports = {
  name: 'LotusExplorer',
  url: 'https://explorer.givelotus.org/ext/summary',
  parseFn(raw: { data: LotusData[] }) {
    const currentDiff: number = +raw.data[0].difficulty;
    const hashRate: number = +raw.data[0].hashrate;
    const currentMinerReward = Math.round((Math.log2(currentDiff / 16) + 1) * 130 * 1000000) / 1000000;
    const dailyElectricityCost = (((hashRate / MINING_EFFICIENCY) * 24) / 1000) * ELECTRICITY_RATE;
    
    const lotusCost = dailyElectricityCost * (1 + MINER_MARGIN) / currentMinerReward /30/24; // Changes to the variable name only

    const stabilizationFactor = ELECTRICITY_RATE / 100 / lotusCost; // for price stablization of 10 lotus = 1 kWh cost of electricity.

    const lotusPrice = lotusCost * ((1 + MINER_MARGIN) + stabilizationFactor);
    
    return [{ code: 'USD', value: Math.round(lotusPrice * 1000000) / 1000000 }];
  }
};
