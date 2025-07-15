import { API, Credentials, Key, Network, TssKey, TssSign, Txp } from 'bitcore-wallet-client';
import { FileStorage } from './filestorage';
export type KeyType = Key;
export type ClientType = API;
export type TssKeyType = TssKey.TssKey;
export type TssSigType = TssSign.ISignature;
export interface WalletData {
    key: KeyType | TssKeyType;
    creds: Credentials;
}
export declare class Wallet {
    #private;
    static _bpCurrencies: any;
    name: string;
    dir: string;
    filename: string;
    storage: FileStorage;
    host: string;
    walletId: string;
    client: ClientType;
    isFullyEncrypted?: boolean;
    constructor(args: {
        name: string;
        dir: string;
        verbose?: boolean;
        host?: string;
        walletId?: string;
    });
    static setVerbose(v: boolean): void;
    getClient(args: {
        mustBeNew?: boolean;
        mustExist?: boolean;
        doNotComplete?: boolean;
    }): Promise<ClientType>;
    create(args: {
        coin?: string;
        chain: string;
        network: Network;
        copayerName: string;
        account: number;
        n: number;
        m?: number;
        mnemonic?: string;
        password?: string;
        addressType?: string;
    }): Promise<{
        key: Key;
        creds: Credentials;
        secret: string;
    }>;
    createFromTss(args: {
        key: TssKeyType;
        chain: string;
        network: Network;
        password: string;
        addressType?: string;
        copayerName: string;
    }): Promise<{
        key: TssKey.TssKey;
        creds: any;
    }>;
    register(args: {
        copayerName: string;
    }): Promise<string>;
    load(opts?: {
        doNotComplete?: boolean;
        allowCache?: boolean;
    }): Promise<Key>;
    save(opts?: {
        encryptAll?: boolean;
    }): Promise<void>;
    export(args: {
        filename: string;
        exportPassword?: string;
    }): Promise<void>;
    import(args: {
        filename: string;
        importPassword?: string;
    }): Promise<void>;
    isComplete(): boolean;
    static getCurrencies(network?: Network): Promise<any>;
    getTokenByAddress(tokenAddress: any): Promise<any>;
    getToken(chain: any, token: any): Promise<any>;
    getTokenFromChain(chain: any, network: any, address: any): Promise<{
        code: any;
        displayCode: any;
        decimals: {
            full: {
                maxDecimals: number;
                minDecimals: number;
            };
            short: {
                maxDecimals: number;
                minDecimals: number;
            };
        };
        precision: number;
        toSatoshis: number;
        contractAddress: any;
        chain: any;
    }>;
    signTxp(args: {
        txp: Txp;
    }): Promise<string[]>;
    _signTxpTss(args: {
        txp: Txp;
        password: string;
    }): Promise<string[]>;
    signAndBroadcastTxp(args: {
        txp: Txp;
    }): Promise<any>;
    getXPrivKey(password?: string): Promise<string>;
    getXPubKey(): string;
    isTss(): boolean;
    getMinSigners(): number;
    isWalletEncrypted(): boolean;
}
//# sourceMappingURL=wallet.d.ts.map