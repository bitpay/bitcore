const Schema = mongoose.Schema;

const TransactionSchema = new Schema({
  txid: String,
  chain: String,
  blockHeight: Number,
  blockHash: String,
  blockTime: Date,
  blockTimeNormalized: Date,
  inputs: [Input],
  outputs: [Output],
  coinbase: Boolean,
  fee: Number,
  inputsProcessed: Boolean,
  wallets: { type: [Schema.Types.ObjectId] },
});

TransactionSchema.index({ txid: 1 }, { unique: true });
TransactionSchema.index({ blockHeight: 1, wallets: 1 });
TransactionSchema.index({ blockHash: 1 });
TransactionSchema.index({ blockTime: 1 });
TransactionSchema.index({ blockTimeNormalized: 1, wallets: 1 });

TransactionSchema.index({ 'outputs.address': 1 });
TransactionSchema.index({ 'inputs.address': 1 });
TransactionSchema.index({ wallets: 1 }, { sparse: true });
TransactionSchema.index({ 'inputs.wallets': 1 }, { sparse: true });
TransactionSchema.index({ 'outputs.wallets': 1 }, { sparse: true });

const Block = mongoose.model('Transaction', TransactionSchema);

module.exports = Block;

