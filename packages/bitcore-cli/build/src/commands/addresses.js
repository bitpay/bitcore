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
exports.getAddresses = getAddresses;
const prompt = __importStar(require("@clack/prompts"));
const os_1 = __importDefault(require("os"));
const utils_1 = require("../utils");
function command(args) {
    const { program } = args;
    program
        .description('List wallet addresses')
        .usage('<walletName> --command addresses [options]')
        .optionsGroup('Addresses Options')
        .option('--page <page>', 'Page number to display', '1')
        .parse(process.argv);
    const opts = program.opts();
    if (opts.help) {
        program.help();
    }
    return opts;
}
async function getAddresses(args) {
    const { wallet, opts } = args;
    if (opts.command) {
        Object.assign(opts, command(args));
    }
    const { pageSize } = opts;
    await utils_1.Utils.paginate(async (page, viewAction) => {
        const addresses = await wallet.client.getMainAddresses({
            limit: pageSize,
            skip: (page - 1) * pageSize
        });
        const lines = [];
        for (const a of addresses) {
            lines.push(`${a.address} (${a.path})`);
        }
        prompt.note(lines.join(os_1.default.EOL), `Addresses (Page ${page})`);
        if (opts.command) {
            return { result: [] };
        }
        return { result: addresses };
    }, { pageSize, initialPage: opts.page, exitOn1Page: !!opts.command });
}
;
//# sourceMappingURL=addresses.js.map