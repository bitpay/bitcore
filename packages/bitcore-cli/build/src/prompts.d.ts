import * as prompt from '@clack/prompts';
import { Network } from 'bitcore-wallet-client';
export declare function getChain(): Promise<string>;
export declare function getNetwork(): Promise<Network>;
export declare function getPassword(msg?: string, opts?: {
    minLength?: number;
    hidden?: boolean;
    validate?: (input: string) => string | null;
}): Promise<string>;
export declare function getMofN(): Promise<string>;
export declare function getIsMultiParty(): Promise<boolean>;
export declare function getMultiPartyScheme(): Promise<"multisig" | "tss">;
export declare function getCopayerName(): Promise<string>;
export declare function getAddressType({ chain, network, isMultiSig }: {
    chain: string;
    network?: Network;
    isMultiSig?: boolean;
}): Promise<string>;
export declare function getAction({ options, initialValue }?: {
    options?: prompt.Option<string>[];
    initialValue?: string;
}): Promise<string | symbol>;
export declare function getFileName(args: {
    message?: string;
    defaultValue: string;
}): Promise<string>;
//# sourceMappingURL=prompts.d.ts.map