import { expect } from 'chai';
import * as SolKit from '@solana/kit';
import * as SolSystem from '@solana-program/system';
import * as SolToken from '@solana-program/token';

// The program that owns a plain SOL wallet account. Re-exported from @solana-program/system rather than
// hardcoded so the tests stay tied to the same constant the library builds its instructions from.
export const SYSTEM_PROGRAM_ADDRESS = SolSystem.SYSTEM_PROGRAM_ADDRESS;

// Token-2022 is a literal because @solana-program/token-2022 is not installed here.
// It is used as documentation in tests - in the general case a token's owner may be this program address, although in this codebase it isn't (10 Sept 26)
export const TOKEN_2022_PROGRAM_ADDRESS = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// Structural assertions for a client.getAccountInfo() result, shared by the real integration tests in
// sol.js and spl.js that hit a local validator or devnet. Keeping this in one place means both suites are
// checking the same result shape, so a change to getAccountInfo's return value only needs to be taught to
// one assertion, not two copy-pasted ones. This is a plain function with no describe/it of its own, so
// importing it has no side effects on either file's own test run.
export const assertAccountInfoShape = result => {
  expect(result).to.be.an('object').that.is.not.null;
  expect(result).to.have.all.keys('lamports', 'atas', 'owner', 'space');
  expect(result).to.have.property('lamports').that.is.a('number').greaterThanOrEqual(0);
  expect(result).to.have.property('atas').that.is.an('array');
  // owner and space are both read off the same getAccountInfo response value, so an account that exists
  // onchain has both and one that doesn't has neither - they can never disagree.
  expect(result.owner === undefined).to.equal(result.space === undefined);
  if (result.owner !== undefined) {
    expect(result).to.have.property('owner').that.is.a('string');
    expect(SolKit.isAddress(result.owner), `owner ${result.owner} is not a valid address`).to.be.true;
    expect(result).to.have.property('space').that.is.a('number').greaterThanOrEqual(0);
  }
  expect(() => JSON.stringify(result)).not.to.throw();
  for (const ata of result.atas) {
    expect(ata).to.be.an('object');
    expect(ata).to.have.property('mint').that.is.a('string');
    expect(ata).to.have.property('pubkey').that.is.a('string');
    expect(ata).to.have.property('state').that.is.a('string');
    expect(ata).to.have.property('atas').that.is.an('array');
  }
};

// Records every call SolRpc/SplRpc makes through `this.rpc.getAccountInfo(...)`, along with the raw
// response the real validator sent back for each one. sinon can't stub this directly - the kit RPC
// client is a Proxy with no own properties, so both sinon.stub and a plain property assignment reject
// it ("Attempted to wrap undefined property" / "trap returned falsish"). Swapping in a Proxy that only
// intercepts the one method under test, and lets everything else through untouched, works around that.
//
// This exists to catch a regression where a dataSlice option gets dropped from one of these calls:
// asserting solRpc.getAccountInfo()/getTokenAccountsByOwner() still resolve correctly wouldn't catch
// that, since removing dataSlice doesn't change what those methods return - the account data payload
// they're now silently paying to fetch is simply unused.
export function recordGetAccountInfoCalls(rpcClient) {
  const realRpc = rpcClient.rpc;
  const calls = [];
  rpcClient.rpc = new Proxy(realRpc, {
    get(target, prop, _receiver) {
      if (prop !== 'getAccountInfo') {
        return Reflect.get(target, prop, target);
      }
      return (...args) => ({
        send: async (...sendArgs) => {
          const response = await target.getAccountInfo(...args).send(...sendArgs);
          calls.push({ args, response });
          return response;
        }
      });
    }
  });
  return {
    calls,
    restore: () => { rpcClient.rpc = realRpc; }
  };
}
