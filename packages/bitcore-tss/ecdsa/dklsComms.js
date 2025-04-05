const { DklsComms: MpcDklsComms } = require('@bitgo/sdk-lib-mpc');
const utils = require('./utils');

const _DklsComms = {};

// @overrides
_DklsComms.encryptAndAuthOutgoingMessages = function encryptAndAuthOutgoingMessages(messages, pubKeys, authKey) {
  return {
    p2pMessages: messages.p2pMessages.map((m) => {
      const partyPubKey = pubKeys.find((k) => k.partyId === m.to);
      if (!partyPubKey) {
        throw Error(`No public key provided for recipient with ID: ${m.to}`);
      }
      if (!authKey) {
        throw Error(`No private key provided for sender with ID: ${m.from}`);
      }

      return {
        to: m.to,
        from: m.from,
        payload: utils.encryptAndDetachSignData(Buffer.from(m.payload, 'base64'), partyPubKey.publicKey, authKey),
        commitment: m.commitment,
      };
    }),
    broadcastMessages: messages.broadcastMessages.map((m) => {
      if (!authKey) {
        throw Error(`No private key provided for sender with ID: ${m.from}`);
      }
      return {
        from: m.from,
        payload: utils.detachSignData(Buffer.from(m.payload, 'base64'), authKey),
        signatureR: m.signatureR ? { message: m.signatureR, signature: '' } : undefined,
      };
    }),
  };
};


// @overrides
_DklsComms.decryptAndVerifyIncomingMessages = function decryptAndVerifyIncomingMessages(messages, authKey) {
  return {
    p2pMessages: messages.flatMap((m) => {
      const partyPubKey = m.publicKey;
      if (!partyPubKey) {
        throw Error(`No public key provided for sender with ID: ${m.from}`);
      }
      if (!authKey) {
        throw Error(`No private key provided for recepient with ID: ${m.to}`);
      }
      return m.p2pMessages.map((p2pMessage) => ({
        to: p2pMessage.to,
        from: p2pMessage.from,
        payload: utils.decryptAndVerifySignedData(p2pMessage.payload, partyPubKey, authKey),
        commitment: p2pMessage.commitment,
      }));
    }),
    broadcastMessages: messages.flatMap((m) => {
      const partyPubKey = m.publicKey;
      if (!partyPubKey) {
        throw Error(`No public key provided for sender with ID: ${m.from}`);
      }
      return m.broadcastMessages.map((broadcastMessage) => {
        if (!utils.verifySignedData(broadcastMessage.payload, partyPubKey)) {
          throw Error(`Failed to authenticate broadcast message from party: ${m.from}`);
        }
        return {
          from: broadcastMessage.from,
          payload: broadcastMessage.payload.message
        };
      });
    }),
  };
};

module.exports.DklsComms = Object.assign({}, MpcDklsComms, _DklsComms);