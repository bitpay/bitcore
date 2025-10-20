"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWallet = createWallet;
const prompts_1 = require("../../prompts");
const crypto_wallet_core_1 = require("crypto-wallet-core");
const createMultiSig_1 = require("./createMultiSig");
const createSingleSig_1 = require("./createSingleSig");
const createThresholdSig_1 = require("./createThresholdSig");
const utils_1 = require("../../utils");
async function createWallet(args) {
    const { wallet, opts } = args;
    await wallet.getClient({});
    const chain = await (0, prompts_1.getChain)();
    const network = await (0, prompts_1.getNetwork)();
    const isMultiParty = await (0, prompts_1.getIsMultiParty)();
    let mnemonic;
    if (!isMultiParty) {
        ({ mnemonic } = await (0, createSingleSig_1.createSingleSigWallet)({ wallet, chain, network, opts }));
    }
    else {
        let useTss = true;
        if (crypto_wallet_core_1.Constants.MULTISIG_CHAINS.includes(chain)) {
            const scheme = await (0, prompts_1.getMultiPartyScheme)();
            useTss = scheme === 'tss';
        }
        const mOfN = await (0, prompts_1.getMofN)();
        const [m, n] = utils_1.Utils.parseMN(mOfN);
        if (useTss) {
            ({ mnemonic } = await (0, createThresholdSig_1.createThresholdSigWallet)({ wallet, chain, network, opts, m, n }));
        }
        else {
            ({ mnemonic } = await (0, createMultiSig_1.createMultiSigWallet)({ wallet, chain, network, opts, m, n }));
        }
    }
    await wallet.getClient({});
    if (!opts.mnemonic) {
        await utils_1.Utils.showMnemonic(wallet.name, mnemonic, opts);
    }
}
;
//# sourceMappingURL=index.js.map