import * as prompt from '@clack/prompts';
import type { Color } from '../types/constants';
import type { ITokenObj } from '../types/wallet';
export declare class Utils {
    static setVerbose(v: boolean): void;
    static die(err?: string | Error): void;
    static goodbye(): void;
    static getWalletFileName(walletName: any, dir: any): string;
    static colorText(text: string, color: Color): string;
    static capitalize(text: string): string;
    static shortID(id: string): string;
    static confirmationId(copayer: {
        xPubKeySignature: string;
    }): string;
    static parseAmount(text: string | number | bigint): number;
    static renderAmount(currency: string, satoshis: number | bigint, opts?: {}): string;
    static renderStatus(status: string): string;
    static parseMN(text: string): [number, number];
    static paginate(fn: (page: number, action?: string) => Promise<{
        result?: any[];
        extraChoices?: prompt.Option<string>[];
    }>, opts?: {
        pageSize?: number;
        initialPage?: number | string;
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
    static amountFromSats(chain: string, sats: number, opts?: ITokenObj): number;
    static amountToSats(chain: string, amount: number | string, opts?: ITokenObj): bigint;
    static maxLength(str: string, maxLength?: number): string;
    static jsonParseWithBuffer(data: string): any;
    static compactString(str: string, length?: number): string;
    static compactAddress(address: string): string;
    static formatDate(date: Date | number | string): string;
    static formatDateCompact(date: Date | number | string): string;
    static replaceTilde(fileName: string): string;
}
//# sourceMappingURL=utils.d.ts.map