"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var BCHTxProvder = (function () {
    function BCHTxProvder() {
        this.lib = require('bitcore-lib-cash');
    }
    BCHTxProvder.prototype.create = function (_a) {
        var recipients = _a.recipients, utxos = _a.utxos, change = _a.change, fee = _a.fee;
        var tx = new this.lib.Transaction().from(utxos).fee(Number(fee));
        for (var _i = 0, recipients_1 = recipients; _i < recipients_1.length; _i++) {
            var recipient = recipients_1[_i];
            tx.to(recipient.address, recipient.amount);
        }
        if (change) {
            tx.change(change);
        }
        return tx;
    };
    return BCHTxProvder;
}());
exports.BCHTxProvder = BCHTxProvder;
exports.default = new BCHTxProvder();
//# sourceMappingURL=index.js.map