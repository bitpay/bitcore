function signOne(hash, addrStr, keys) {
  var keyObj = keys[addrStr];
  var rawPrivKey = new Buffer(keyObj.priv, 'hex');
  var key = new KeyModule.Key();
  key.private = rawPrivKey;
  var signature = key.signSync(hash);

  return signature;
}

function signTxIn(nIn, tx, txInputs, network, keys, scripts) {
  // locate TX input needing a signature
  var txin = tx.ins[nIn];
  var scriptSig = txin.getScript();

  // locate TX output, within txInputs
  var txoutHash = txin.getOutpointHash();
  if (!(txoutHash in txInputs))
    throw new Error("signTxIn missing input hash");
  var txFrom = txInputs[txoutHash];
  var txoutIndex = txin.getOutpointIndex();
  if (txFrom.outs.length >= txoutIndex)
    throw new Error("signTxIn missing input index");
  var txout = txFrom.outs[txoutIndex];
  var scriptPubKey = txout.getScript();

  // detect type of transaction, and extract useful elements
  var txType = scriptPubKey.classify();
  if (txType == TX_UNKNOWN)
    throw new Error("unknown TX type");
  var scriptData = scriptPubKey.capture();

  // if P2SH, lookup the script
  var subscriptRaw = undefined;
  var subscript = undefined;
  var subType = undefined;
  var subData = undefined;
  if (txType == TX_SCRIPTHASH) {
    var addr = new Address(network.P2SHVersion, scriptData[0]);
    var addrStr = addr.toString();
    if (!(addrStr in scripts))
      throw new Error("unknown script hash address");

    subscriptRaw = new Buffer(scripts[addrStr], 'hex');
    subscript = new Script(subscriptRaw);
    subType = subscript.classify();
    if (subType == TX_UNKNOWN)
      throw new Error("unknown subscript TX type");
    subData = subscript.capture();
  }

  var hash = tx.hashForSignature(scriptPubKey, i, 0);

  switch (txType) {
    case TX_PUBKEY:
      // already signed
      if (scriptSig.chunks.length > 0)
        return;

      var pubkeyhash = util.sha256ripe160(scriptData[0]);
      var addr = new Address(network.addressVersion, pubkeyhash);
      var addrStr = addr.toString();
      if (!(addrStr in keys))
        throw new Error("unknown pubkey");

      var signature = signOne(hash, addrStr, keys);
      scriptSig.writeBytes(signature);
      break;

    case TX_PUBKEYHASH:
      // already signed
      if (scriptSig.chunks.length > 0)
        return;

      var addr = new Address(network.addressVersion, scriptData[0]);
      var addrStr = addr.toString();
      if (!(addrStr in keys))
        throw new Error("unknown pubkey hash address");

      var signature = signOne(hash, addrStr, keys);
      scriptSig.writeBytes(signature);
      scriptSig.writeBytes(key.public);
      break;

    case TX_SCRIPTHASH:
      // already signed
      if (scriptSig.chunks.length > 0)
        return;

      var addr = new Address(network.addressVersion, subData[0]);
      var addrStr = addr.toString();
      if (!(addrStr in keys))
        throw new Error("unknown script(pubkey hash) address");

      var signature = signOne(hash, addrStr, keys);
      scriptSig.writeBytes(signature);
      scriptSig.writeBytes(key.public);
      break;

    case TX_MULTISIG:
      while (scriptSig.chunks.length < scriptData.length) {
        scriptSig.writeBytes(util.EMPTY_BUFFER);
      }
      for (var i = 0; i < scriptData.length; i++) {
        // skip already signed
        if (scriptSig.chunks[i].length > 0)
          continue;

        var pubkeyhash = util.sha256ripe160(scriptSig.chunks[i]);
        var addr = new Address(network.addressVersion, pubkeyhash);
        var addrStr = addr.toString();
        if (!(addrStr in keys))
          continue;

        var signature = signOne(hash, addrStr, keys);
        scriptSig.chunks[i] = signature;
      }
      break;
  }

  if (txtype == TX_SCRIPTHASH)
    scriptSig.writeBytes(subscriptRaw);
}

exports.Transaction = function Transaction(tx, txInputs, network, keys, scripts) {
  for (var i = 0; i < tx.ins.length; i++)
    signTxIn(i, tx, txInputs, network, keys, scripts);
};
