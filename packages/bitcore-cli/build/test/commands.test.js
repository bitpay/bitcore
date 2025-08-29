"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const assert_1 = __importDefault(require("assert"));
const cli_commands_1 = require("../src/cli-commands");
const constants_1 = require("../src/constants");
describe('Option: --command', function () {
    const COMMANDS = (0, cli_commands_1.getCommands)({ wallet: {}, opts: { command: 'any' } });
    describe('NEW', function () {
        for (const cmd of COMMANDS.NEW) {
            it(cmd.value, function () {
                assert_1.default.throws(() => (0, child_process_1.execSync)(`node build/src/cli.js --command ${cmd.value} --help --verbose`, { encoding: 'utf-8' }), `Error: Running "${cmd.value}" directly is not supported. Use the interactive CLI`);
            });
        }
    });
    describe('BASIC', function () {
        for (const cmd of COMMANDS.BASIC) {
            it(cmd.value, function () {
                try {
                    const output = (0, child_process_1.execSync)(`node build/src/cli.js wallet --command ${cmd.value} --help --verbose`, { encoding: 'utf-8' });
                    assert_1.default.equal(output.includes(constants_1.bitcoreLogo), true);
                }
                catch (err) {
                    const error = err?.stdout || err;
                    if (cmd['noCmd']) {
                        assert_1.default.equal(error.includes(`Running "${cmd.value}" directly is not supported. Use the interactive CLI`), true);
                    }
                    else {
                        throw new Error(error);
                    }
                }
            });
        }
    });
    describe('ADVANCED', function () {
        for (const cmd of COMMANDS.ADVANCED) {
            it(cmd.value, function () {
                try {
                    const output = (0, child_process_1.execSync)(`node build/src/cli.js wallet --command ${cmd.value} --help --verbose`, { encoding: 'utf-8' });
                    assert_1.default.equal(output.includes(constants_1.bitcoreLogo), true);
                }
                catch (err) {
                    const error = err?.stdout || err;
                    if (cmd['noCmd']) {
                        assert_1.default.equal(error.includes(`Running "${cmd.value}" directly is not supported. Use the interactive CLI`), true);
                    }
                    else {
                        throw new Error(error);
                    }
                }
            });
        }
    });
});
//# sourceMappingURL=commands.test.js.map