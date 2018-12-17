export declare class BTCTxProvder {
    lib: any;
    create({ recipients, utxos, change, fee }: {
        recipients: any;
        utxos: any;
        change: any;
        fee: any;
    }): any;
    sign({ tx, keys, utxos }: {
        tx: any;
        keys: any;
        utxos: any;
    }): any;
    getRelatedUtxos({ outputs, utxos }: {
        outputs: any;
        utxos: any;
    }): any;
    getOutputsFromTx({ tx }: {
        tx: any;
    }): any;
    getSigningAddresses({ tx, utxos }: {
        tx: any;
        utxos: any;
    }): any;
}
declare const _default: BTCTxProvder;
export default _default;
