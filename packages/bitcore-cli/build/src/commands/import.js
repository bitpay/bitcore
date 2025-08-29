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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importWallet = importWallet;
const prompt = __importStar(require("@clack/prompts"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const errors_1 = require("../errors");
const prompts_1 = require("../prompts");
async function importWallet(args) {
    const { wallet, opts } = args;
    const replaceTilde = str => str.startsWith('~') ? str.replace('~', os_1.default.homedir()) : str;
    const filename = await prompt.text({
        message: 'Enter filename to import:',
        initialValue: `~/${wallet.name}-export.json`,
        validate: (value) => {
            value = value.trim();
            if (!value)
                return 'Filename is required';
            value = replaceTilde(value);
            if (!fs_1.default.existsSync(value)) {
                return 'File does not exist: ' + value;
            }
            return;
        }
    });
    if (prompt.isCancel(filename)) {
        throw new errors_1.UserCancelled();
    }
    const importPassword = await (0, prompts_1.getPassword)('Import/export password:', { hidden: true });
    await wallet.import({
        filename: replaceTilde(filename),
        importPassword
    });
    prompt.log.success(`Wallet ${wallet.name} imported successfully!`);
}
;
//# sourceMappingURL=import.js.map