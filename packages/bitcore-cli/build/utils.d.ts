import * as prompt from '@clack/prompts';
export declare class Utils {
    static setVerbose(v: any): void;
    static die(err: any): void;
    static goodbye(): void;
    static getWalletFileName(walletName: any, dir: any): string;
    static colorText(text: any, color: any): any;
    static capitalize(text: any): any;
    static shortID(id: any): any;
    static confirmationId(copayer: any): string;
    static parseAmount(text: any): number;
    static renderAmount(satoshis: any, coin: any, opts?: {}): string;
    static renderStatus(status: any): any;
    static parseMN(text: string): [number, number];
    static paginate(fn: (page: number, action?: string) => Promise<{
        result?: any[];
        extraChoices?: prompt.Option<string>[];
    }>, opts?: {
        pageSize?: number;
        exitOn1Page?: boolean;
    }): Promise<void>;
    static showMnemonic(walletName: string, mnemonic: string, opts: {
        dir: string;
    }): Promise<void>;
    static getSegwitInfo(addressType: string): {
        useNativeSegwit: boolean;
        segwitVersion: number;
    };
    static getFeeUnit(chain: string): "lamports" | "gwei" | "sat/kB" | "drops";
    static displayFeeRate(chain: string, feeRate: number): string;
    static convertFeeRate(chain: string, feeRate: number): number;
    static amountFromSats(chain: string, sats: number): number;
    static amountToSats(chain: string, amount: number | string): bigint;
    static maxLength(str: string, maxLength?: number): string;
    static jsonParseWithBuffer(data: string): any;
    static compactString(str: string, length?: number): string;
    static compactAddress(address: string): string;
}
//# sourceMappingURL=utils.d.ts.map