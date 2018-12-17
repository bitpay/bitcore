"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var program = require('commander');
var _parse = program.parse.bind(program);
program.parse = function (args) {
    _parse(args);
    var requiredOptions = program.options.filter(function (opt) { return opt.required && opt.required !== 0; });
    var programProps = Object.getOwnPropertyNames(program);
    for (var _i = 0, _a = program.options; _i < _a.length; _i++) {
        var option = _a[_i];
        var optionName = option.long.replace('--', '');
        var required = option.required && option.required !== 0;
        var missing = !programProps.includes(optionName);
        if (required && missing) {
            throw new Error("Missing required flag: --" + optionName);
        }
    }
};
exports.default = program;
//# sourceMappingURL=program.js.map