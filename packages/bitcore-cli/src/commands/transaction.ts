import * as prompt from '@clack/prompts';
import type { CommonArgs } from '../../types/cli';
import type { ITokenObj } from '../../types/wallet';
import os from 'os';
import { type Txp } from 'bitcore-wallet-client'; 
import { UserCancelled } from '../errors';
import { Utils } from '../utils';
import { Validation } from 'crypto-wallet-core';

export function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('Create and send a transaction')
    .usage('<walletName> --command transaction [options]')
    .optionsGroup('Transaction Options')
    .option('--to <address>', 'Recipient address')
    .option('--amount <amount>', 'Amount to send (in BTC/ETH/etc). Use "max" to send all available balance')
    .option('--fee <fee>', 'Fee to use')
    .option('--feeRate <rate>', 'Custom fee rate in sats/b, gwei, drops, etc.')
    .option('--feeLevel <level>', 'Fee level to use (e.g. low, normal, high)', 'normal')
    .option('--nonce <nonce>', 'Nonce for the transaction (optional, for chains that require it)')
    .option('--token <token>', 'Token to get the balance for (e.g. USDC)')
    .option('--tokenAddress <address>', 'Token contract address to get the balance for')
    .option('--note <note>', 'Note for the transaction')
    .option('--dry-run', 'Only create the transaction proposal without broadcasting')
    .parse(process.argv);
  
  const opts = program.opts();
  if (opts.help) {
    program.help();
  }

  if (!opts.to) {
    throw new Error('Recipient address (--to) is required');
  }
  if (!parseFloat(opts.amount) && opts.amount !== 'max') {
    throw new Error('Missing or invalid amount (--amount) specified');
  }
  if (opts.fee && !parseFloat(opts.fee)) {
    throw new Error('Invalid fee specified.');
  }
  if (opts.feeRate && !parseFloat(opts.feeRate)) {
    throw new Error('Invalid fee rate specified.');
  }

  return opts;
}

export async function createTransaction(
  args: CommonArgs<{
    to?: string;
    amount?: string;
    fee?: string;
    feeRate?: string;
    feeLevel?: string;
    nonce?: number;
    note?: string;
    dryRun?: boolean;
  }>
) {
  const { wallet, opts } = args;
  let { status } = args;
  const { chain, network } = wallet.client.credentials;

  if (opts.command) {
    Object.assign(opts, command(args));
  }

  let tokenObj: ITokenObj;
  if (opts.token || opts.tokenAddress) {
    tokenObj = await wallet.getToken(opts);
    if (!tokenObj) {
      throw new Error(`Unknown token "${opts.tokenAddress || opts.token}" on ${chain}:${network}`);
    }
  }

  if (!status) {
    status = await wallet.client.getStatus({ tokenAddress: tokenObj?.contractAddress });
  }

  const { balance } = status;
  const currency = tokenObj?.displayCode || chain.toUpperCase();
  const availableAmount = Utils.amountFromSats(chain, balance.availableAmount, tokenObj);

  if (!balance.availableAmount) {
    prompt.log.warn(`You have no available balance to send ${currency} on ${chain}:${network}.`);
    return;
  }


  const to = opts.to || await prompt.text({
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

  const amount = opts.amount || await prompt.text({
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
  const amountSats = amount === 'max' ? undefined : Utils.amountToSats(chain, amount, tokenObj); // Convert to satoshis 

  const note = opts.command ? opts.note : await prompt.text({
    message: 'Enter a note for this transaction (optional):',
    placeholder: 'e.g. paid Hal for pizza',
    initialValue: '',
  });
  if (prompt.isCancel(note)) {
    throw new UserCancelled();
  }

  const feeLevels = await wallet.client.getFeeLevels(chain, network);
  const defaultLevel = feeLevels.find(level => level.level === 'normal') || feeLevels[0];

  const feeLevel = opts.command ? (opts.feeLevel || 'custom') : await prompt.select({
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

  let customFeeRate: string | symbol = opts.feeRate;
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
    fee: opts.fee ? parseFloat(opts.fee) : undefined,
    sendMax,
    tokenAddress: tokenObj?.contractAddress
  };

  let txp: Txp = await wallet.client.createTxProposal({
    ...txpParams,
    dryRun: true
  });


  const lines = [];
  lines.push(`To: ${to}`);
  lines.push(`Amount: ${Utils.renderAmount(currency, txp.amount, tokenObj)}`);
  lines.push(`Fee: ${Utils.renderAmount(chain, txp.fee)} (${Utils.displayFeeRate(chain, txp.feePerKb)})`);
  lines.push(`Total: ${tokenObj 
    ? Utils.renderAmount(currency, txp.amount, tokenObj) + ` + ${Utils.renderAmount(chain, txp.fee)}`
    : Utils.renderAmount(currency, txp.amount + txp.fee)
  }`);
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
