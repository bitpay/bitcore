// Types from https://github.com/arx-research/libhalo/blob/master/docs/halo-command-set.md#command-sign
export type DataType =
  'publicKey' | 'compressedPublicKey' | 'publicKeyAttest' |
  'keySlotFlag' | 'keySlotFlag' | 'keySlotFailedAuthCtr' |
  'keySlotFailState' | 'keySlotAuthUnlockChallenge' | 'latchValue' |
  'latchAttest' | 'graffiti' | 'firmwareVersion';
