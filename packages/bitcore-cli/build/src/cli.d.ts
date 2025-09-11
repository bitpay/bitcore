#!/usr/bin/env node
import { Wallet } from './wallet';
export declare const wallet: Wallet;
export declare const COMMANDS: {
    readonly EXIT: {
        readonly label: "Exit";
        readonly value: "exit";
        readonly hint: "Exit the wallet CLI";
    };
    readonly NEW: readonly [{
        readonly label: "Create Wallet";
        readonly value: "create";
        readonly hint: "Create a fresh, new wallet (multi or single sig)";
    }, {
        readonly label: "Join Wallet";
        readonly value: "join";
        readonly hint: "Join an existing multi-sig wallet session";
    }, {
        readonly label: "Import Seed";
        readonly value: "import-seed";
        readonly hint: "Import using a 12-24 word mnemonic phrase";
    }, {
        readonly label: "Import File";
        readonly value: "import-file";
        readonly hint: "Import using a file";
    }];
    readonly BASIC: readonly [{
        readonly label: ({ token }: {
            token: any;
        }) => string;
        readonly value: "token";
        readonly hint: "Manage the token context for this session";
        readonly show: () => boolean;
        readonly noCmd: true;
    }, {
        readonly label: ({ ppNum }: {
            ppNum: any;
        }) => string;
        readonly value: "txproposals";
        readonly hint: "Get pending transaction proposals";
    }, {
        readonly label: "Send";
        readonly value: "transaction";
        readonly hint: "Create a transaction to send funds";
    }, {
        readonly label: "Receive";
        readonly value: "address";
        readonly hint: "Get an address to receive funds to";
    }, {
        readonly label: "History";
        readonly value: "history";
        readonly hint: "Get the transaction history of your wallet";
    }, {
        readonly label: "Balance";
        readonly value: "balance";
        readonly hint: "Get the balance of your wallet";
    }, {
        readonly label: "Status";
        readonly value: "status";
        readonly hint: "Get the status of your wallet";
    }];
    readonly SHOW_ADVANCED: {
        readonly label: "Show Advanced...";
        readonly value: "advanced";
        readonly hint: "Show advanced actions";
    };
    readonly ADVANCED: readonly [{
        readonly label: "Message";
        readonly value: "sign";
        readonly hint: "Sign an arbitrary message with your wallet's private key";
    }, {
        readonly label: "Addresses";
        readonly value: "addresses";
        readonly hint: "List all of your wallet's addresses";
    }, {
        readonly label: "UTXOs";
        readonly value: "utxos";
        readonly hint: "Get the unspent transaction outputs of your wallet";
    }, {
        readonly label: "Preferences";
        readonly value: "preferences";
        readonly hint: "Get or set wallet preferences";
    }, {
        readonly label: "Derive";
        readonly value: "derive";
        readonly hint: "Derive a key along a path you will specify";
    }, {
        readonly label: "Export";
        readonly value: "export";
        readonly hint: "Export the wallet to a file";
    }, {
        readonly label: "Scan";
        readonly value: "scan";
        readonly hint: "Scan the wallet for funds";
    }, {
        readonly label: "Register";
        readonly value: "register";
        readonly hint: "Register the wallet with the Bitcore Wallet Service";
    }, {
        readonly label: "Clear Cache";
        readonly value: "clearcache";
        readonly hint: "Clear the wallet cache";
    }];
};
//# sourceMappingURL=cli.d.ts.map