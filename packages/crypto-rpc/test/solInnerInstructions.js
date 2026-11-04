import { expect } from 'chai';
import { instructionKeys, parseJsonParsedInstructions } from '../lib/sol/transaction-parser.js';

const SYSTEM = '11111111111111111111111111111111';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

describe('parseJsonParsedInstructions', function() {
  it('parses a system transfer the way top-level transferSol is shaped', function() {
    const parsed = parseJsonParsedInstructions([
      { programId: SYSTEM, program: 'system', parsed: { type: 'transfer', info: { source: 'S', destination: 'D', lamports: 5000 } } }
    ]);
    expect(parsed[instructionKeys.TRANSFER_SOL]).to.deep.equal([{ amount: 5000, currency: 'SOL', destination: 'D', source: 'S' }]);
  });

  it('parses a token transfer the way top-level transferToken is shaped', function() {
    const parsed = parseJsonParsedInstructions([
      { programId: TOKEN, program: 'spl-token', parsed: { type: 'transfer', info: { authority: 'A', source: 'S', destination: 'D', amount: '42' } } }
    ]);
    expect(parsed[instructionKeys.TRANSFER_TOKEN]).to.deep.equal([{ authority: 'A', destination: 'D', source: 'S', amount: 42 }]);
  });

  it('parses a token transferChecked the way top-level transferCheckedToken is shaped', function() {
    // jsonParsed nests the amount and decimals under tokenAmount (shape taken from a mainnet tx)
    const parsed = parseJsonParsedInstructions([
      {
        programId: TOKEN,
        program: 'spl-token',
        parsed: {
          type: 'transferChecked',
          info: {
            authority: 'A', source: 'S', destination: 'D', mint: 'M',
            tokenAmount: { amount: '74683783', decimals: 9, uiAmount: 0.074683783, uiAmountString: '0.074683783' }
          }
        }
      }
    ]);
    expect(parsed[instructionKeys.TRANSFER_CHECKED_TOKEN]).to.deep.equal([{ authority: 'A', destination: 'D', mint: 'M', source: 'S', amount: 74683783, decimals: 9 }]);
  });

  it('still reads a transferChecked amount and decimals given directly on info', function() {
    const parsed = parseJsonParsedInstructions([
      { programId: TOKEN, program: 'spl-token', parsed: { type: 'transferChecked', info: { authority: 'A', source: 'S', destination: 'D', mint: 'M', amount: '42', decimals: 6 } } }
    ]);
    expect(parsed[instructionKeys.TRANSFER_CHECKED_TOKEN]).to.deep.equal([{ authority: 'A', destination: 'D', mint: 'M', source: 'S', amount: 42, decimals: 6 }]);
  });

  it('keeps instructions it does not parse under unknown, with their program address', function() {
    const createAccount = { programId: SYSTEM, program: 'system', parsed: { type: 'createAccount', info: {} } };
    const parsed = parseJsonParsedInstructions([createAccount]);
    expect(parsed[instructionKeys.UNKNOWN]).to.deep.equal([{ ...createAccount, programAddress: SYSTEM }]);
  });
});
