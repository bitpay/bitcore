"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setToken = setToken;
const prompt = __importStar(require("@clack/prompts"));
const errors_1 = require("../errors");
const utils_1 = require("../utils");
const wallet_1 = require("../wallet");
async function setToken(args) {
    const { wallet, opts } = args;
    const currencies = await wallet_1.Wallet.getCurrencies(wallet.network);
    function findTokenObj(value) {
        return currencies.find(c => c.contractAddress?.toLowerCase() === value.toLowerCase() ||
            c.displayCode?.toLowerCase() === value.toLowerCase() ||
            c.code?.toLowerCase() === value.toLowerCase());
    }
    ;
    const token = await prompt.text({
        message: 'Enter the token name or address (blank to unset):',
        placeholder: 'e.g. USDC',
        validate: (value) => {
            if (!value || findTokenObj(value)) {
                return null;
            }
            return 'No token found';
        }
    });
    if (prompt.isCancel(token)) {
        throw new errors_1.UserCancelled();
    }
    const tokenObj = token ? findTokenObj(token) : null;
    if (tokenObj) {
        prompt.log.success(utils_1.Utils.colorText('Session is now in token mode: ', 'green') + `${tokenObj.displayCode} - ${tokenObj.contractAddress}`);
    }
    else {
        prompt.log.success(utils_1.Utils.colorText('Session is now in native currency mode', 'green'));
    }
    return { action: 'menu', tokenObj };
}
//# sourceMappingURL=token.js.map