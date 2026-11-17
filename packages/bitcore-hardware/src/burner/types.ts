import type { EventEmitter } from 'events';

// Types from https://github.com/arx-research/libhalo/blob/master/docs/halo-command-set.md#command-sign
export type DataType =
  'publicKey' | 'compressedPublicKey' | 'publicKeyAttest' |
  'keySlotFlag' | 'keySlotFailedAuthCtr' | 'keySlotFailState' |
  'keySlotAuthUnlockChallenge' | 'latchValue' | 'latchAttest' |
  'graffiti' | 'firmwareVersion';

export type CommandNameType = 
  'sign' | 'sign_random' | 'sign_challenge' |
  'write_latch' | 'cfg_ndef' | 'gen_key' |
  'gen_key_confirm' | 'get_pkeys' | 'get_key_info' |
  'set_password' | 'unset_password' | 'get_data_struct_v2'

export interface Reader extends EventEmitter {
  reader: any;
  logger: any;
  connection: { type: number; protocol: number } | null;
  card: any | null;
  autoProcessing: boolean;
  keyStorage: { '0': Buffer | number[] | null; '1': Buffer | number[] | null };
  pendingLoadAuthenticationKey: Record<string, Promise<number>>;
    
  get aid(): Buffer | ((card: any) => Buffer) | null;
  set aid(value: string | Buffer | ((card: any) => Buffer));
  get name(): string;
  
  reverseBuffer(src: Buffer): Buffer;
  selectStandardByAtr(atr: Buffer): string;
  
  connect(mode?: string): Promise<{ type: number; protocol: number }>;
  disconnect(): Promise<boolean>;
  transmit(data: Buffer | number[], responseMaxLength: number): Promise<Buffer>;
  control(data: Buffer | number[], responseMaxLength: number): Promise<Buffer>;
  loadAuthenticationKey(keyNumber: 0 | 1, key: Buffer | number[] | string): Promise<0 | 1>;
  authenticate(
    blockNumber: number,
    keyType: number,
    key: Buffer | number[] | string,
    obsolete?: boolean,
  ): Promise<boolean>;
  read(
    blockNumber: number,
    length: number,
    blockSize?: number,
    packetSize?: number,
    readClass?: number,
  ): Promise<Buffer>;
  write(blockNumber: number, data: Buffer, blockSize?: number): Promise<boolean>;
  handleTag(): false | Promise<void | boolean>;
  handle_Iso_14443_3_Tag(): Promise<void | false>;
  handle_Iso_14443_4_Tag(): Promise<void | false>;
  close(): void;
  toString(): string;
}
