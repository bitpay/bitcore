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
//# sourceMappingURL=filestorage.d.ts.map