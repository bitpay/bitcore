import { Credentials, Key, type Network, TssKey, Txp } from 'bitcore-wallet-client';
import type { ClientType, ITokenObj, IWallet, TssKeyType } from '../types/wallet';
import { type Types as CWCTypes } from 'crypto-wallet-core';
import { FileStorage } from './filestorage';
export declare class Wallet implements IWallet {
    #private;
    static _bpCurrencies: ITokenObj[];
    name: string;
    dir: string;
    filename: string;
    storage: FileStorage;
    host: string;
    walletId: string;
    client: ClientType;
    isFullyEncrypted?: boolean;
    get chain(): string;
    get network(): Network;
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
    static getCurrencies(network: Network): Promise<ITokenObj[]>;
    getToken(args: {
        token?: string;
        tokenAddress?: string;
    }): Promise<ITokenObj>;
    getTokenByAddress(args: {
        tokenAddress: string;
    }): Promise<ITokenObj>;
    getTokenByName(args: {
        token: string;
    }): Promise<ITokenObj>;
    getTokenFromChain(args: {
        address: string;
    }): Promise<ITokenObj>;
    getPasswordWithRetry(): Promise<string>;
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
    signMessage(args: {
        message: string;
        derivationPath: string;
        encoding?: BufferEncoding | 'base58';
    }): Promise<CWCTypes.Message.ISignedMessage>;
    _signMessageWithTss(args: {
        messageHash: Buffer;
        derivationPath?: string;
        password?: string;
        encoding?: BufferEncoding | 'base58';
    }): Promise<CWCTypes.Message.ISignedMessage>;
    getXPrivKey(password?: string): Promise<string>;
    getXPubKey(): string;
    isMultiSig(): boolean;
    isTss(): boolean;
    getMinSigners(): number;
    isWalletEncrypted(): boolean;
    isUtxo(): boolean;
    isEvm(): boolean;
    isSvm(): boolean;
    isXrp(): boolean;
}
//# sourceMappingURL=wallet.d.ts.map