// Based on https://github.com/pokusew/nfc-pcsc/tree/v0.8.1/src
declare module 'nfc-pcsc' {
  import { EventEmitter } from 'events';

  export const TAG_ISO_14443_3 = 'TAG_ISO_14443_3';
  export const TAG_ISO_14443_4 = 'TAG_ISO_14443_4';
  export const KEY_TYPE_A = 0x60;
  export const KEY_TYPE_B = 0x61;
  export const CONNECT_MODE_DIRECT = 'CONNECT_MODE_DIRECT';
  export const CONNECT_MODE_CARD = 'CONNECT_MODE_CARD';

  export const UNKNOWN_ERROR = 'unknown_error';
  export const FAILURE = 'failure';
  export const CARD_NOT_CONNECTED = 'card_not_connected';
  export const OPERATION_FAILED = 'operation_failed';

  export type TagType = typeof TAG_ISO_14443_3 | typeof TAG_ISO_14443_4;
  export type KeyType = typeof KEY_TYPE_A | typeof KEY_TYPE_B;
  export type ConnectMode = typeof CONNECT_MODE_DIRECT | typeof CONNECT_MODE_CARD;

  export interface Logger {
    log(...args: any[]): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
  }

  export interface Card {
    atr?: Buffer;
    standard?: TagType;
    type?: TagType;
    /** Set for ISO 14443-3 tags when autoProcessing is enabled */
    uid?: string;
    /** Set for ISO 14443-4 tags when autoProcessing is enabled (response to SELECT AID) */
    data?: Buffer;
  }

  export interface Connection {
    type: number;
    protocol: number;
  }

  export type Aid = Buffer | ((card: Card) => Buffer);

  /** Underlying @pokusew/pcsclite CardReader */
  export interface PcscReader extends EventEmitter {
    name: string;
    state: number;
    connected: boolean;
    close(): void;
    [key: string]: any;
  }

  export interface ReaderEvents {
    card: [card: Card];
    'card.off': [card: Card];
    error: [error: Error];
    end: [];
  }

  export class Reader extends EventEmitter<ReaderEvents> {
    reader: PcscReader;
    logger: Logger;
    connection: Connection | null;
    card: Card | null;
    /** When false, 'card' is emitted right after connecting, without reading UID/selecting AID */
    autoProcessing: boolean;
    keyStorage: { '0': Buffer | null; '1': Buffer | null };
    pendingLoadAuthenticationKey: Record<string, Promise<number>>;

    static reverseBuffer(src: Buffer): Buffer;
    static selectStandardByAtr(atr: Buffer): TagType;

    constructor(reader: PcscReader, logger?: Logger);

    get aid(): Aid | null;
    set aid(value: string | Aid);
    get name(): string;

    connect(mode?: ConnectMode): Promise<Connection>;
    disconnect(): Promise<boolean>;
    transmit(data: Buffer, responseMaxLength: number): Promise<Buffer>;
    control(data: Buffer, responseMaxLength: number): Promise<Buffer>;
    loadAuthenticationKey(keyNumber: 0 | 1, key: Buffer | number[] | string): Promise<0 | 1>;
    authenticate(
      blockNumber: number,
      keyType: KeyType,
      key: Buffer | number[] | string,
      obsolete?: boolean
    ): Promise<boolean>;
    read(
      blockNumber: number,
      length: number,
      blockSize?: number,
      packetSize?: number,
      readClass?: number
    ): Promise<Buffer>;
    write(blockNumber: number, data: Buffer, blockSize?: number): Promise<boolean>;
    handleTag(): false | Promise<void | false>;
    handle_Iso_14443_3_Tag(): Promise<void | false>;
    handle_Iso_14443_4_Tag(): Promise<void | false>;
    close(): void;
    toString(): string;
  }

  export class ACR122Reader extends Reader {
    inAutoPoll(): Promise<void>;
    led(led: number, blinking: number[] | Buffer): Promise<void>;
    setBuzzerOutput(enabled?: boolean): Promise<void>;
    setPICC(picc: number): Promise<void>;
  }

  export interface NFCEvents {
    reader: [reader: Reader | ACR122Reader];
    error: [error: Error];
  }

  export class NFC extends EventEmitter<NFCEvents> {
    pcsc: EventEmitter & { readers: Record<string, PcscReader>; close(): void };
    logger: Logger;

    constructor(logger?: Logger);

    get readers(): Record<string, PcscReader>;
    close(): void;
  }

  export class BaseError extends Error {
    code: string | null;
    previous?: Error;
    constructor(code?: string | null, message?: string | null, previousError?: Error);
  }
  export class TransmitError extends BaseError {}
  export class ControlError extends BaseError {}
  export class ReadError extends BaseError {}
  export class WriteError extends BaseError {}
  export class LoadAuthenticationKeyError extends BaseError {}
  export class AuthenticationError extends BaseError {}
  export class ConnectError extends BaseError {}
  export class DisconnectError extends BaseError {}
  export class GetUIDError extends BaseError {}
}
