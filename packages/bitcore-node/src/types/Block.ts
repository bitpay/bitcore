export type IBlock = {
  chain: string;
  coinbaseTxId: string;
  coinbaseUnlockingScript: string;
  coinbaseUnlockingScriptUtf8: string;
  coinbaseSequenceNumber: number;
  coinbaseMintTxId: string;
  coinbaseMintIndex: number;
  confirmations?: number;
  network: string;
  height: number;
  hash: string;
  version: number;
  merkleRoot: string;
  time: Date;
  timeNormalized: Date;
  nonce: number;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  size: number;
  bits: number;
  reward: number;
  processed: boolean;
};

export type BlockJSON = {
  chain: string;
  /**
   * The transaction hash of this block's coinbase transaction.
   */
  coinbaseTxId: string;
  /**
   * The unlocking script from the input of this block's coinbase transaction.
   *
   * When validating coinbase transactions, the unlocking script is not
   * evaluated in the authentication virtual machine like other unlocking
   * scripts, so miners/mining pools can include any bytes in this field.
   *
   * The only consensus limitation is that BIP 34 must be followed: the first
   * element of this field must be the block height encoded as a Script Number.
   */
  coinbaseUnlockingScript: string;

  /**
   * The contents of `coinbaseUnlockingScript`, decoded as a utf8 string. This
   * field is often used by miners and mining pools for network signaling, i.e.
   * broadcasting support for a new consensus or protocol change.
   *
   * Often, a pool name will be included in this field to claim credit for the
   * block, but note that this information can always be falsified to "blame"
   * another entity for the block.
   *
   * For more information, see `coinbaseUnlockingScript`.
   */
  coinbaseUnlockingScriptUtf8: string;
  /**
   * In most BCH and BTC mining software implementations, this value defaults to
   *  0xFFFFFFFF. However, there are no consensus limitations on the value, and
   * many blocks have been mined with other coinbase sequence numbers, e.g.
   * block `000000000000000002ac55f2ada57d8f6034bf079fc3c16cdd961531650045db`.
   */
  coinbaseSequenceNumber: number;
  /**
   * Since coinbase transactions are creating new funds (rather the outputs of
   * other transactions), there is no true `mintTxid` for a coinbase
   * transaction.
   *
   * However, coinbase transactions are still serialized in the
   * same format as other transactions, so this field is currently required by
   * consensus validation in BCH and BTC to be the "null hash":
   * `0000000000000000000000000000000000000000000000000000000000000000`.
   */
  coinbaseMintTxId: string;
  /**
   * This field is currently required by consensus validation in BCH and BTC to
   * be the maximum 32-bit integer: `FFFFFFFF` (`4294967295`).
   *
   * For more information, see `coinbaseMintTxId`.
   */
  coinbaseMintIndex: number;
  confirmations?: number;
  network: string;
  height: number;
  hash: string;
  version: number;
  merkleRoot: string;
  /**
   * The block's recorded block time in ISO format. See `timeNormalized` for a
   * more reliable time key.
   */
  time: string;
  /**
   * The normalized block time in ISO format. `timeNormalized` is the best
   * estimate for when something actually occurred in real time, since it
   * adjusts for inaccurate timestamps in individual blocks.
   *
   * Bitcore ensures that 1) the parent block has a `timeNormalized` value
   * which is earlier than this `timeNormalized`, and 2) all child blocks
   * have `timeNormalized` values which are later than this `timeNormalized`.
   *
   * It's a good idea to use `timeNormalized` rather than `time` for most
   * applications, particularly when choosing a time value for an external
   * accounting ledger.
   */
  timeNormalized: string;
  nonce: number;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  size: number;
  bits: number;
  reward: number;
};
