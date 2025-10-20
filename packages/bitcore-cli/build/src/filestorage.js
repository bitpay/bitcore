"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorage = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
class FileStorage {
    constructor(opts) {
        if (!opts.filename) {
            throw new Error('Please set wallet filename');
        }
        this.filename = opts.filename;
    }
    getName() {
        return this.filename;
    }
    async save(data) {
        await fs_1.default.promises.mkdir(path_1.default.dirname(this.filename), { recursive: true });
        await fs_1.default.promises.writeFile(this.filename, data);
    }
    async load() {
        try {
            let data = await fs_1.default.promises.readFile(this.filename, 'utf8');
            data = utils_1.Utils.jsonParseWithBuffer(data);
            return data;
        }
        catch {
            utils_1.Utils.die('Invalid input file');
        }
    }
    exists() {
        return fs_1.default.existsSync(this.filename);
    }
}
exports.FileStorage = FileStorage;
;
//# sourceMappingURL=filestorage.js.map