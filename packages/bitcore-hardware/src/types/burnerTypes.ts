// Types from https://github.com/arx-research/libhalo/blob/master/docs/halo-command-set.md#command-sign
export type DataType =
  'publicKey' | 'compressedPublicKey' | 'publicKeyAttest' |
  'keySlotFlag' | 'keySlotFlag' | 'keySlotFailedAuthCtr' |
  'keySlotFailState' | 'keySlotAuthUnlockChallenge' | 'latchValue' |
  'latchAttest' | 'graffiti' | 'firmwareVersion';

export type CommandNameType = 
  'sign' | 'sign_random' | 'sign_challenge' |
  'write_latch' | 'cfg_ndef' | 'gen_key' |
  'gen_key_confirm' | 'get_pkeys' | 'get_key_info' |
  'set_password' | 'unset_password' | 'get_data_struct_v2'
