export declare class FileStorage {
    filename: string;
    constructor(opts: {
        filename: string;
    });
    getName(): string;
    save(data: string): Promise<void>;
    load(): Promise<any>;
    exists(): boolean;
}
export interface IWalletData {
    key: {};
    creds: {};
}
//# sourceMappingURL=filestorage.d.ts.map