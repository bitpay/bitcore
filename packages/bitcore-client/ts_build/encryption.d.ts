/// <reference types="node" />
export declare function shaHash(data: any, algo?: string): string;
export declare function encryptEncryptionKey(encryptionKey: any, password: any): string;
export declare function decryptEncryptionKey(encEncryptionKey: any, password: any): string;
export declare function encryptPrivateKey(privKey: any, pubKey: any, encryptionKey: any): string;
declare function decryptPrivateKey(encPrivateKey: any, pubKey: any, encryptionKey: any): string;
export declare function generateEncryptionKey(): Buffer;
export declare const Encryption: {
    encryptEncryptionKey: typeof encryptEncryptionKey;
    decryptEncryptionKey: typeof decryptEncryptionKey;
    encryptPrivateKey: typeof encryptPrivateKey;
    decryptPrivateKey: typeof decryptPrivateKey;
    generateEncryptionKey: typeof generateEncryptionKey;
};
export {};
