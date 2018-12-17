import { Client } from './client';
import { Storage } from './storage';
import { Request } from 'request';
export declare namespace Wallet {
    type KeyImport = {
        address: string;
        privKey: string;
        pubKey: string;
    };
    type WalletObj = {
        name: string;
        baseUrl: string;
        chain: string;
        network: string;
        path: string;
        phrase: string;
        password: string;
        storage: Storage;
    };
}
export declare class Wallet {
    masterKey: any;
    baseUrl: string;
    chain: string;
    network: string;
    client: Client;
    storage: Storage;
    unlocked?: {
        encryptionKey: string;
        masterKey: string;
    };
    password: string;
    encryptionKey: string;
    authPubKey: string;
    pubKey: string;
    name: string;
    path: string;
    authKey: string;
    derivationPath: string;
    constructor(params: Wallet | Wallet.WalletObj);
    saveWallet(): Promise<any>;
    static create(params: Partial<Wallet.WalletObj>): Promise<Wallet>;
    static exists(params: any): Promise<boolean>;
    static loadWallet(params: any): Promise<Wallet>;
    lock(): void;
    unlock(password: any): Promise<this>;
    register(params?: {
        baseUrl?: string;
    }): Promise<any>;
    getAuthSigningKey(): any;
    getBalance(): Promise<any>;
    getNetworkFee(params: any): Promise<any>;
    getUtxos(params: any): Request;
    listTransactions(params: any): Request;
    newTx(params: any): Promise<any>;
    broadcast(params: any): Promise<any>;
    importKeys(params: {
        keys: Partial<Wallet.KeyImport>[];
    }): Promise<{}>;
    signTx(params: any): Promise<any>;
}
