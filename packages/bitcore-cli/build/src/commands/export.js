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
exports.command = command;
exports.exportWallet = exportWallet;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const prompt = __importStar(require("@clack/prompts"));
const errors_1 = require("../errors");
const prompts_1 = require("../prompts");
function command(args) {
    const { wallet, program } = args;
    program
        .description('Export wallet to a file')
        .usage('<walletName> --command export [options]')
        .optionsGroup('Export Options')
        .option('--filename <filename>', 'Filename to export to', `~/${wallet.name}-export.json`)
        .parse(process.argv);
    const opts = program.opts();
    if (opts.help) {
        program.help();
    }
    return opts;
}
async function exportWallet(args) {
    const { wallet, opts } = args;
    if (opts.command) {
        Object.assign(opts, command(args));
    }
    const replaceTilde = str => str.startsWith('~') ? str.replace('~', os_1.default.homedir()) : str;
    const filename = opts.filename || await prompt.text({
        message: 'Enter filename to export to:',
        initialValue: `~/${wallet.name}-export.json`,
        validate: (value) => {
            value = value.trim();
            if (!value)
                return 'Filename is required';
            value = replaceTilde(value);
            try {
                let _path = '';
                for (const part of value.split('/').slice(0, -1)) {
                    _path = path_1.default.join(_path, part);
                    if (fs_1.default.existsSync(_path)) {
                        fs_1.default.accessSync(_path, fs_1.default.constants.W_OK);
                    }
                    else {
                        break;
                    }
                }
            }
            catch (err) {
                return 'Cannot write to the specified file path: ' + err.message;
            }
            return;
        }
    });
    if (prompt.isCancel(filename)) {
        throw new errors_1.UserCancelled();
    }
    const exportPassword = await (0, prompts_1.getPassword)('Import/export password:', { hidden: false, minLength: 6 });
    await wallet.export({
        filename: replaceTilde(filename),
        exportPassword
    });
    prompt.log.success('Exported to ' + filename);
}
;
//# sourceMappingURL=export.js.map