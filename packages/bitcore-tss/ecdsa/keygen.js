const bitcoreLib = require('bitcore-lib');
const { DklsDkg, DklsTypes } = require('@bitgo/sdk-lib-mpc');
const { DklsComms } = require('./dklsComms');
const { encrypt, decrypt } = require('./utils');

const $ = bitcoreLib.util.preconditions;

class KeyGen {
  #partySize;
  #minSigners;
  #partyId;
  #seed;
  #authKey;
  #dkg;
  #round;

  /**
   * Create a new Threshold Signature Scheme (TSS) key generation instance
   * @param {object} params
   * @param {number} params.n Number of participants
   * @param {number} params.m Minimum number of signers
   * @param {number} params.partyId Party id
   * @param {Buffer} [params.seed] Seed for the DKG. Randomly generated if not given
   * @param {Buffer} params.authKey Authentication key for the DKG
   * @param {number} params.round Round number for the DKG
   */
  constructor({ n, m, partyId, seed, authKey, round }) {
    $.checkArgument(n != null, 'n is required');
    $.checkArgument(m != null, 'm is required');
    $.checkArgument(partyId != null, 'partyId is required');
    $.checkArgument(authKey != null, 'authKey is required');

    $.checkArgument(n > 1, 'n must be greater than 1');
    this.#partySize = parseInt(n);

    $.checkArgument(m > 0 && m <= n, 'm must be in the range [1, n]');
    this.#minSigners = parseInt(m);

    $.checkArgument(partyId >= 0 && partyId < n, 'partyId must be in the range [0, n-1]');
    this.#partyId = parseInt(partyId);

    $.checkArgument(seed == null || Buffer.isBuffer(seed) && seed.length === 32, 'seed must be a 32 byte buffer');
    this.#seed = seed;

    this.#authKey = new bitcoreLib.PrivateKey(authKey);
    $.checkArgument(this.#authKey.toString('hex') === authKey.toString('hex') || this.#authKey.toWIF() === authKey, 'Unrecognized authKey format');

    $.checkArgument(round == null || (round >= 0 && round <= 5), 'round must be in the range [0, 5]');
    this.#round = parseInt(round) || 0;

    this.#dkg = new DklsDkg.Dkg(this.#partySize, this.#minSigners, this.#partyId, this.#seed);
  }

  getRound() {
    return this.#round;
  }

  /**
   * Export the keygen session to a base64 encoded string
   * @returns {string} Base64 encoded session string
   */
  export() {
    $.checkState(this.#round > 0, 'Cannot export a session that has not started');
    $.checkState(!this.isKeyChainReady(), 'Cannot export a completed session. The keychain is ready with getKeyChain()');
    const chainCodeCommitment = this.#dkg.chainCodeCommitment;
    const sessionBytes = this.#dkg.dkgSessionBytes || this.#dkg.dkgSession?.toBytes();
    const seedBytes = this.#dkg.seed;
    const payload = this.#round +
      ':' + this.#partySize +
      ':' + this.#minSigners +
      ':' + this.#partyId +
      ':' + Buffer.from(sessionBytes).toString('base64') +
      ':' + Buffer.from(chainCodeCommitment || []).toString('base64') +
      ':' + seedBytes.toString('base64');

    const buf = encrypt(Buffer.from(payload, 'utf8'), this.#authKey.publicKey, this.#authKey);
    return buf.toString('base64');
  }

  /**
   * Restore a keygen session from an exported session
   * @param {object} params
   * @param {string} params.session Base64 encoded session string
   * @param {bitcoreLib.PrivateKey} params.authKey Private key to use for decrypting the session
   * @returns {Sign}
   */
  static async restore({ session, authKey }) {
    const _authKey = new bitcoreLib.PrivateKey(authKey);
    $.checkArgument(_authKey.toString('hex') === authKey.toString('hex') || _authKey.toWIF() === authKey, 'Unrecognized authKey format');
    session = decrypt(Buffer.from(session, 'base64'), _authKey.publicKey, _authKey).toString('utf8');
    const [
      round,
      partySize,
      minSigners,
      partyId,
      sessionBytes,
      chainCodeCommitment,
      seedBytes
    ] = session.split(':');
    const initParams = {
      round: parseInt(round),
      n: parseInt(partySize),
      m: parseInt(minSigners),
      partyId: parseInt(partyId),
      authKey,
      seed: Buffer.from(seedBytes, 'base64')
    };
    const keygen = new KeyGen(initParams);
    await keygen.#dkg.loadDklsWasm();
    keygen.#dkg.dkgState = parseInt(round);
    keygen.#dkg.dkgSessionBytes = new Uint8Array(Buffer.from(sessionBytes, 'base64'));
    keygen.#dkg.chainCodeCommitment = chainCodeCommitment ? new Uint8Array(Buffer.from(chainCodeCommitment, 'base64')) : undefined;
    return keygen;
  }

  /**
   * @private
   * Format the message to be sent to the other parties
   * @param {object} signedMessage
   * @returns 
   */
  _formatMessage(signedMessage) {
    return {
      round: this.#round++,
      partyId: this.#partyId,
      publicKey: this.#authKey.publicKey.toString(),
      p2pMessages: signedMessage.p2pMessages,
      broadcastMessages: signedMessage.broadcastMessages,
    };
  }

  /**
   * Initialize the keygen session with a broadcast message to send to the other participants
   * @returns {Promise<{round: number, partyId: number, publicKey: string, p2pMessages: object[], broadcastMessages: object[]}>}
   */
  async initJoin() {
    $.checkState(this.#round == 0, 'initJoin must be called before the rounds ');

    const unsignedMessageR1 = await this.#dkg.initDkg();
    const serializedMsg = DklsTypes.serializeBroadcastMessage(unsignedMessageR1);
    const signedMessage = await DklsComms.encryptAndAuthOutgoingMessages(
      { broadcastMessages: [serializedMsg], p2pMessages: [] },
      [],
      this.#authKey
    );

    return this._formatMessage(signedMessage);
  }

  /**
   * Call this after receiving the initJoin broadcast messages from the other participants
   *  and while isKeyChainReady() is false
   * @param {Array<object>} prevRoundMessages 
   * @returns {{ round: number, partyId: number, publicKey: string, p2pMessages: object[], broadcastMessage: object[] }}
   */
  nextRound(prevRoundMessages) {
    $.checkState(this.#round > 0, 'initJoin must be called before participating in the rounds');
    $.checkState(this.#round < 5, 'Signing rounds are over');
    $.checkArgument(Array.isArray(prevRoundMessages), 'prevRoundMessages must be an array');
    $.checkArgument(prevRoundMessages.length === this.#partySize - 1, 'Not ready to proceed to the next round');
    $.checkArgument(prevRoundMessages.every(msg => msg.round === this.#round - 1), 'All messages must be from the previous round');
    $.checkArgument(prevRoundMessages.every(msg => msg.partyId !== this.#partyId), 'Messages must not be from the yourself');

    const prevRoundIncomingMsgs = DklsComms.decryptAndVerifyIncomingMessages(prevRoundMessages, this.#authKey);

    const thisRoundMessages = DklsTypes.serializeMessages(
      this.#dkg.handleIncomingMessages(DklsTypes.deserializeMessages(prevRoundIncomingMsgs))
    );

    const signedMessage = DklsComms.encryptAndAuthOutgoingMessages(
      thisRoundMessages,
      prevRoundMessages.map(m => ({ partyId: m.partyId, publicKey: m.publicKey })),
      this.#authKey
    );

    return this._formatMessage(signedMessage);
  }

  /**
   * Check if the keychain is ready
   * @returns {boolean}
   */
  isKeyChainReady() {
    return this.#round === 5;
  }

  /**
   * Get the keychain
   * @returns {{ privateKeyShare: Buffer, reducedPrivateKeyShare: Buffer, commonKeyChain: string }} Keychain object
   */
  getKeyChain() {
    $.checkState(this.isKeyChainReady(), 'Key chain is not ready');

    const keyShare = this.#dkg.getKeyShare();
    const rKeyShare = this.#dkg.getReducedKeyShare();
    const commonKeyChain = DklsTypes.getCommonKeychain(keyShare);

    return {
      privateKeyShare: keyShare,
      reducedPrivateKeyShare: rKeyShare,
      commonKeyChain: commonKeyChain
    };
  }
};

module.exports.KeyGen = KeyGen;