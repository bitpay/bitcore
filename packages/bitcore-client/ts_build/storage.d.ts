import { LevelUp } from 'levelup';
export declare class Storage {
    path: string;
    db: LevelUp;
    constructor(params: any);
    loadWallet(params: {
        name: string;
    }): Promise<any>;
    listWallets(): any;
    saveWallet(params: any): Promise<any>;
    getKey(params: any): Promise<any>;
    addKeys(params: any): Promise<any>;
}
