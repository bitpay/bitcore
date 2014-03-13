


var run = function() {
  bitcore = typeof (bitcore) === 'undefined' ? require('../bitcore') : bitcore;

  var priv    = 'cTgGUrcro89yUtKeG6gHBAS14r3qp25KwTTxG9d4kEzcFxecuZDm';
  var amt     = '0.005';
  var toAddress = 'myuAQcCc1REUgXGsCTiYhZvPPc3XxZ36G1';
  var changeAddressString = 'moDz3jEo9q7CxjBDjmb13sL4SKkgo2AACE';
  var feeString = '0.0001';

  var safeUnspent = [
  {
  address: "mqSjTad2TKbPcKQ3Jq4kgCkKatyN44UMgZ",
  hash: "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
  vout: 1,
  ts: 1394719301,
  scriptPubKey: "76a9146ce4e1163eb18939b1440c42844d5f0261c0338288ac",
  amount: 0.01,
  confirmations: 2
  }
  ]
  ;

  console.log('TX Data: BTC:' + amt + ' => '+ toAddress + ', change To:' + changeAddressString ) ;
  console.log('Unspends:', safeUnspent);

  var wk  = new bitcore.WalletKey({
    network: bitcore.networks.testnet
  });
  wk.fromObj({ priv: priv, });

  var wkObj= wk.storeObj();
  var keyPairs = [{
    key: wkObj.priv,
    address: wkObj.addr,
  }];
  console.log('KEY DB IS:', keyPairs); 

  var Address = bitcore.Address;
  var Transaction = bitcore.Transaction;
  var Script = bitcore.Script;
  var nets = bitcore.networks;
  var z = bitcore.bignum(0);
  var amt = bitcore.util.parseValue(amt);

  if(z.cmp(amt) === 0 )
    throw "spend amount must be greater than zero";

  if(!changeAddressString)
    throw "change address was not provided";

  var fee = bitcore.util.parseValue(feeString || '0');
  var total = bitcore.bignum(0).add(amt).add(fee);
  var address = new Address(toAddress);
  var sendTx = new Transaction();
  var i;

  var unspent = [];
  var unspentAmt = bitcore.bignum(0);


  for(i=0;i<safeUnspent.length;i++) {
    unspent.push(safeUnspent[i]);

        var amountSatoshiString = new bitcore.bignum(safeUnspent[i].amount * Math.pow(10,8)).toString();

        unspentAmt = unspentAmt.add(new bitcore.bignum(amountSatoshiString));

        // If > -1, we have enough to send the requested amount
        if(unspentAmt.cmp(total) > -1) {
          break;
        }
      }

      if(unspentAmt.cmp(total) < 0) {
        throw "you do not have enough bitcoins to send this amount";
      }

      var txobj = {};
      txobj.version = 1;
      txobj.lock_time = 0;
      txobj.ins = [];
      txobj.outs = [];
      
      for(i=0;i<unspent.length;i++) {
        var txin = {};

        txin.s = bitcore.util.EMPTY_BUFFER;
        txin.q = 0xffffffff;

        var hash = new bitcore.Buffer(unspent[i].hash, 'hex');
        var hashReversed = bitcore.buffertools.reverse(hash);
        var vout = parseInt(unspent[i].vout);
        var voutBuf = new bitcore.Buffer(4);
        voutBuf.writeUInt32LE(vout, 0);

        txin.o = bitcore.Buffer.concat([hashReversed, voutBuf]);
        txobj.ins.push(txin); 
      }


      // This is not used really, but we keep it for the future.
      var version = address.version();
      var script;
      if (version == nets.livenet.addressPubkey || version == nets.testnet.addressPubkey)
        script = Script.createPubKeyHashOut(address.payload());
      else if (version == nets.livenet.addressScript || version == nets.testnet.addressScript)
        script = Script.createP2SH(address.payload());
      else
        throw new Error('invalid output address');

      var value = bitcore.util.bigIntToValue(amt);
      var txout = {
        v: value,
        s: script.getBuffer(),
      };
      txobj.outs.push(txout);
      var remainder = unspentAmt.sub(total);

      if(z.cmp(amt) !== 0 ) {
        var changeAddress = new Address(changeAddressString);
        var changeValue = bitcore.util.bigIntToValue(remainder);

        // This is not used really, but we keep it for the future.
        var cversion = changeAddress.version();
        var cscript;
        if (cversion == nets.livenet.addressPubkey || cversion == nets.testnet.addressPubkey)
          cscript = Script.createPubKeyHashOut(changeAddress.payload());
        else if (cversion == nets.livenet.addressScript || cversion == nets.testnet.addressScript)
          cscript = Script.createP2SH(changeAddress.payload());
        else
          throw new Error('invalid change output address');

        var change = {
          v: changeValue,
          s: cscript.getBuffer(),
        };
        txobj.outs.push(change);
      }

      var tx = new Transaction(txobj);
      var anypay = false;
      var l = unspent.length;
      var allFound = l;

      // Here will be the beginning of your signing for loop
      for(i=0;i < l;i++) {
        var scriptBuf = new bitcore.Buffer(unspent[i].scriptPubKey, 'hex');

        var s = new Script(scriptBuf);
        if (s.classify() !==  Script.TX_PUBKEYHASH) {
          throw new Error('input script type '+ s.getRawOutType() +' not supported yet');
        }
        var txSigHash = tx.hashForSignature(s, i,
                  anypay ? Transaction.SIGHASH_ANYONECANPAY : Transaction.SIGHASH_ALL);


  //      txSigHash = bitcore.buffertools.reverse(txSigHash);

        for(var j=0;j<keyPairs.length;j++) {
          var kp = keyPairs[j];
          if(kp.address === unspent[i].address) {
            console.log('SIGNING With...', kp.key); //TODO
            console.log('HASH TO SIGN: ',bitcore.buffertools.toHex(txSigHash)); //TODO
            var wKey = new bitcore.WalletKey({network: bitcore.networks.testnet});
            wKey.fromObj({
              priv: kp.key,
            });

            console.log('PRIV KEY', bitcore.buffertools.toHex(wKey.privKey.private )); //TODO
            console.log('PUB KEY', bitcore.buffertools.toHex(wKey.privKey.public )); //TODO

            var sigRaw = wKey.privKey.signSync(txSigHash);
            console.log('SIGNATURE: ',bitcore.buffertools.toHex(sigRaw)); //TODO

            console.log('VERIFY: ',wKey.privKey.verifySignatureSync(txSigHash, sigRaw)); //TODO

            var sigType = new bitcore.Buffer(1);
            sigType[0] = anypay ? Transaction.SIGHASH_ANYONECANPAY : Transaction.SIGHASH_ALL;
            var sig = bitcore.Buffer.concat([sigRaw, sigType]);

            var scriptSig = new Script();
            scriptSig.chunks.push(sig);
            scriptSig.chunks.push(wKey.privKey.public);
            scriptSig.updateBuffer();
            tx.ins[i].s = scriptSig.getBuffer();
            allFound--;
            break;
          }
        }
      }

      if (allFound !== 0)  {
        throw new Error('could not find priv key for some inputs');
      }

  var txHex = tx.serialize().toString('hex');
  console.log('TX HEX IS: ', txHex);
};


module.exports.run = run;
if (require.main === module) {
  run();
}

////

