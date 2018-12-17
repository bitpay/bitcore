"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var BTCTxProvder = (function () {
    function BTCTxProvder() {
        this.lib = require('bitcore-lib');
    }
    BTCTxProvder.prototype.create = function (_a) {
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
    BTCTxProvder.prototype.sign = function (_a) {
        var tx = _a.tx, keys = _a.keys, utxos = _a.utxos;
        var bitcoreTx = new this.lib.Transaction(tx);
        var applicableUtxos = this.getRelatedUtxos({
            outputs: bitcoreTx.inputs,
            utxos: utxos
        });
        var newTx = new this.lib.Transaction()
            .from(applicableUtxos)
            .to(this.getOutputsFromTx({ tx: bitcoreTx }));
        var privKeys = keys.map(function (key) { return key.privKey.toString('hex'); });
        return newTx.sign(privKeys);
    };
    BTCTxProvder.prototype.getRelatedUtxos = function (_a) {
        var outputs = _a.outputs, utxos = _a.utxos;
        var txids = outputs.map(function (output) { return output.toObject().prevTxId; });
        var applicableUtxos = utxos.filter(function (utxo) { return txids.includes(utxo.txid); });
        return applicableUtxos;
    };
    BTCTxProvder.prototype.getOutputsFromTx = function (_a) {
        var tx = _a.tx;
        return tx.outputs.map(function (_a) {
            var script = _a.script, satoshis = _a.satoshis;
            var address = script;
            return { address: address, satoshis: satoshis };
        });
    };
    BTCTxProvder.prototype.getSigningAddresses = function (_a) {
        var tx = _a.tx, utxos = _a.utxos;
        var bitcoreTx = new this.lib.Transaction(tx);
        var applicableUtxos = this.getRelatedUtxos({
            outputs: bitcoreTx.inputs,
            utxos: utxos
        });
        return applicableUtxos.map(function (utxo) { return utxo.address; });
    };
    return BTCTxProvder;
}());
exports.BTCTxProvder = BTCTxProvder;
exports.default = new BTCTxProvder();
//# sourceMappingURL=index.js.map