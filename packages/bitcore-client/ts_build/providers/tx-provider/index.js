"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var providers = {
    BTC: require('./btc'),
    BCH: require('./bch')
};
var TxProvider = (function () {
    function TxProvider() {
    }
    TxProvider.prototype.get = function (_a) {
        var chain = _a.chain;
        return providers[chain];
    };
    TxProvider.prototype.create = function (params) {
        return this.get(params).create(params);
    };
    TxProvider.prototype.sign = function (params) {
        return this.get(params).sign(params);
    };
    TxProvider.prototype.getSigningAddresses = function (params) {
        return this.get(params).getSigningAddresses(params);
    };
    return TxProvider;
}());
exports.TxProvider = TxProvider;
exports.default = new TxProvider();
//# sourceMappingURL=index.js.map