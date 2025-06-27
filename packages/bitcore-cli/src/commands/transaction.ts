import * as prompt from '@clack/prompts';
import { Status, Txp } from 'bitcore-wallet-client'; 
import { Validation } from 'crypto-wallet-core';
import os from 'os';
import { UserCancelled } from '../errors';
import { Utils } from '../utils';
import { Wallet } from '../wallet';

export async function createTransaction(args: {
  wallet: Wallet;
  status: Status;
  opts: {
    verbose: boolean;
    pageSize: number;
  }
}) {
  const { wallet, status, opts } = args;
  const { chain, network } = wallet.client.credentials;
  const { balance } = status;
  const availableAmount = Utils.amountFromSats(chain, balance.availableAmount)

  if (!balance.availableAmount) {
    prompt.log.warn(`You have no available balance to send on ${chain}:${network}.`);
    return;
  }

  const currency = chain.toUpperCase(); // TODO: handle tokens

  const to = await prompt.text({
    message: 'Enter the recipient address:',
    placeholder: 'e.g. n2HRFgtoihgAhx1qAEXcdBMjoMvAx7AcDc',
    validate: (value) => {
      if (!Validation.validateAddress(chain, network, value)) {
        return `Invalid address for ${chain}:${network}`;
      }
      return; // valid value
    }
  });
  if (prompt.isCancel(to)) {
    throw new UserCancelled();
  }

  const amount = await prompt.text({
    message: 'Enter the amount to send:',
    placeholder: 'Type `help` for help and to see your balance',
    validate: (value) => {
      if (value === 'help') {
        return `Enter a value in ${currency}` + os.EOL +
          'Examples:' + os.EOL +
          ` 0.1 - sends 0.1 ${currency}` + os.EOL +
          ' max - sends your whole balance (minus fees)' + os.EOL +
          os.EOL +
          `Your current balance is: ${availableAmount} ${currency}`;
      }
      if (value === 'max') {
        return; // valid value, will be handled later
      }
      const val = parseFloat(value);
      if (isNaN(val) || val <= 0) {
        return 'Please enter a valid amount greater than 0';
      }
      if (val > availableAmount) {
        return 'You cannot send more than your balance';
      }
      return; // valid value
    },
  });
  if (prompt.isCancel(amount)) {
    throw new UserCancelled();
  }

  const sendMax = amount === 'max';
  const amountSats = amount === 'max' ? undefined : Utils.amountToSats(chain, amount); // Convert to satoshis 

  const note = await prompt.text({
    message: 'Enter a note for this transaction (optional):',
    placeholder: 'e.g. paid Hal for pizza',
    initialValue: '',
  });
  if (prompt.isCancel(note)) {
    throw new UserCancelled();
  }

  const feeLevels = await wallet.client.getFeeLevels(chain, network);
  const defaultLevel = feeLevels.find(level => level.level === 'normal') || feeLevels[0];

  const feeLevel = await prompt.select({
    message: 'Select a fee level:',
    options: feeLevels.map(level => ({
      label: `${Utils.capitalize(level.level)} - ${Utils.displayFeeRate(chain, level.feePerKb)}`,
      value: level.level,
      hint: level.nbBlocks ? `Estimated ${level.nbBlocks} blocks` : undefined
    })).concat([{
      label: 'Custom...',
      value: 'custom'
    }]),
    initialValue: defaultLevel.level,
  });
  if (prompt.isCancel(feeLevel)) {
    throw new UserCancelled();
  }

  let customFeeRate;
  if (feeLevel === 'custom') {
    const [defaultFeeRate, feeUnits] = Utils.displayFeeRate(chain, defaultLevel.feePerKb).split(' ');
    customFeeRate = await prompt.text({
      message: `Enter a custom fee rate in ${feeUnits}:`,
      placeholder: `${Utils.capitalize(defaultLevel.level)} rate is ${defaultFeeRate} ${feeUnits}`,
      validate: (value) => {
        const val = parseFloat(value);
        if (isNaN(val) || val <= 0) {
          return `Please enter a valid fee rate greater than 0 ${feeUnits}`;
        }
        return; // valid value
      }
    });
    if (prompt.isCancel(customFeeRate)) {
      throw new UserCancelled();
    }
  }

  const txpParams = {
    outputs: [{
      toAddress: to,
      amount: amountSats,
    }],
    message: note,
    feeLevel: feeLevel === 'custom' ? undefined : feeLevel,
    feePerKb: feeLevel === 'custom' ? parseFloat(customFeeRate) : undefined,
    sendMax
  };

  let txp: Txp = await wallet.client.createTxProposal({
    ...txpParams,
    dryRun: true
  });


  const lines = [];
  lines.push(`To: ${to}`);
  lines.push(`Amount: ${Utils.renderAmount(txp.amount, chain)}`);
  lines.push(`Fee: ${Utils.renderAmount(txp.fee, chain)} (${Utils.displayFeeRate(chain, txp.feePerKb)})`);
  lines.push(`Total: ${Utils.renderAmount(txp.amount + txp.fee, chain)} ${currency}`);
  if (txp.nonce != null) {
    lines.push(`Nonce: ${txp.nonce}`);
  }
  if (note) {
    lines.push(`Note: ${txp.message}`);
  }
  prompt.note(lines.join(os.EOL), 'Transaction Preview');
  
  const confirmed = await prompt.confirm({
    message: 'Send this transaction?' + (wallet.isTss() ? ` (This wallet requires ${wallet.getMinSigners() - 1} other participant(s) be ready to sign)` : ''),
    initialValue: true,
  });
  if (prompt.isCancel(confirmed) || !confirmed) {
    prompt.log.warn('Transaction cancelled by user.');
    return;
    // await wallet.client.removeTxProposal(txp);
  }

  txp = await wallet.client.createTxProposal(txpParams);
  txp = await wallet.client.publishTxProposal({ txp });
  txp = await wallet.signAndBroadcastTxp({ txp });

  if (txp.status === 'broadcasted') {
    prompt.log.success(`Txid: ${Utils.colorText(txp.txid, 'green')}`);
  } else {
    prompt.log.info(`Proposal ${txp.id} signed. More signatures needed to broadcast.`);
  }
};


// TODO: finish this
// export async function createTransactionWithUri(args: {
//   client: ClientType;
//   opts: {
//     verbose: boolean;
//   }
// }) {
//   const { client, opts } = args;

//   const uri = await prompt.text({
//     message: 'Enter the payment URI:',
//     placeholder: 'e.g. bitcoin:?r=https://paypro.url/1234',
//     validate: (value) => {
//       if (!value.startsWith('bitcoin:') && !value.startsWith('bitcoincash:')) {
//         return 'Invalid payment URI. It should start with "bitcoin:" or "bitcoincash:"';
//       }
//       return; // valid value
//     }
//   });
//   if (prompt.isCancel(uri)) {
//     throw new UserCancelled();
//   }

//   // TODO fetch paypro OR parse BIP21 URI

//   // TODO: this AI generated is trash:
//   const payPro = await client.fetchPayPro({ payProUrl: uri });
//   if (!payPro.verified) {
//     throw new Error('Failed to verify payment protocol signatures');
//   }

//   const amountStr = Wallet.renderAmount(payPro.amount, client.credentials.coin);
//   const confirmed = await prompt.confirm({
//     message: `Confirm send ${amountStr} to ${payPro.memo}?`,
//     initialValue: true,
//   });
//   if (!confirmed) {
//     throw new UserCancelled();
//   }

//   // await createTransaction({
//   //   client,
//   //   status: { balance: { availableAmount: payPro.amount } }, // Mock status for balance
//   //   opts
//   // });
// };





/** DELETE THE BELOW - keeping for reference */


// program.on('--help', function() {
//   console.log('  Examples:');
//   console.log('');
//   console.log('    $ wallet-send n2HRFgtoihgAhx1qAEXcdBMjoMvAx7AcDc 500bit');
//   console.log('    $ wallet-send mgWeRvUC6d1LRPKtdDbvYEpaUEmApS4XrY 0.2btc "dinner with friends"');
//   console.log('    $ wallet-send https://paypro.url/1234 # will ask for confirmation ');
//   console.log('');
// });
// program.parse(process.argv);

// var args = program.args;
// if (!args[0])
//   program.help();


// function confirmDiag(amountStr, note, cb) {
//   const readline = require('readline');

//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
//   });

//   rl.question(`Confirm send ${amountStr} to ${note}? (y/N)`, (answer) => {
//     rl.close();
//     return cb(answer =='y');
//   });
// };


// function send(client, address, amount, fee, note, uri) { 
//   var amount;

//   fee = fee || 'normal';
//   client.createTxProposal({
//     outputs: [{
//       toAddress: address,
//       amount: amount,
//     }],
//     message: note,
//     feeLevel: fee,
//     payProUrl: uri,
//   }, function(err, txp) {
//     utils.die(err);
//     client.publishTxProposal({
//       txp: txp
//     }, function(err) {
//       utils.die(err);
//       console.log(' * Tx created: ID %s [%s] RequiredSignatures:',
//         utils.shortID(txp.id), txp.status, txp.requiredSignatures);
//     });
//   });
// };


// var arg1 = args[0];
// var uri;



// utils.getClient(program, {
//   mustExist: true
// }, function(client) {
//   var coin = client.credentials.coin;
//   var bitcore = Bitcore_[coin];

//   var uri, addr, amount, note;

//   // no backwards compat uri
//   if ((/^bitcoin(cash)?:\?r=[\w+]/).exec(arg1)) {
//     var coin2 = 'btc';
//     if (arg1.indexOf('bitcoincash') === 0) coin2 = 'bch';
//     if (coin != coin2) utils.die('Wallet / Payment Coin mismatch');
//     uri  = arg1.replace(/bitcoin(cash)?:\?r=/, '');

//   } else {

//     // BIP21
//     try { 

//       var parsed = new bitcore.URI(arg1);
//       if (!parsed.r) {

//         addr = parsed.address ? parsed.address.toString() : '';
//         note = parsed.message;
//         amount = parsed.amount ? parsed.amount : '';

//       } else {
//         uri = parsed.r;
//       }
//     } catch (e) {
//       uri = null;
//     }
//   }

//   //Send to URI or addr

//   if (uri) {
//     console.log('Fetching Payment from: ' + uri);
//     client.fetchPayPro({
//       payProUrl: uri,
//     }, function(err, paypro) {
//       if (err) {
//         utils.die(' Failed to fetch payment: ' + (_.isObject(err)? JSON.stringify(err) : err));
//       } else if (!paypro.verified) {
//         utils.die('Failed to verify payment protocol signatures');
//       }

//       var amountStr = utils.renderAmount(paypro.amount, coin);
//       confirmDiag(amountStr, paypro.memo, function(confirmed) {
//         if (!confirmed) utils.die('User canceled');
//         send(client, paypro.toAddress, paypro.amount, program.fee, paypro.memo, uri);
//       });
//     });
//   } else {

//     // Grab data from CLI if not set before
//     addr = addr || arg1;
//     amount = amount || utils.parseAmount(args[1]);
//     note = note ||  args[2];

//     send(client, addr, amount, program.fee, note);
//   }
// });
