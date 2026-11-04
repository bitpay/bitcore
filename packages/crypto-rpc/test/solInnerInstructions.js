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

  it('keeps instructions it does not parse under unknown, with their program address', function() {
    const createAccount = { programId: SYSTEM, program: 'system', parsed: { type: 'createAccount', info: {} } };
    const parsed = parseJsonParsedInstructions([createAccount]);
    expect(parsed[instructionKeys.UNKNOWN]).to.deep.equal([{ ...createAccount, programAddress: SYSTEM }]);
  });
});
