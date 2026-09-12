'use strict';

import * as chai from 'chai';
import { Errors } from '../src/lib/errors/errordefinitions';
import { assertKeygenPartyOwnership } from '../src/lib/tss-keygen-party';

const expect = chai.expect;

describe('assertKeygenPartyOwnership', function() {
  it('allows a new party to claim an empty slot', function() {
    expect(function() {
      assertKeygenPartyOwnership({
        participants: ['alice', undefined],
        partyId: 1,
        copayerId: 'bob',
        n: 3
      });
    }).to.not.throw();
  });

  it('allows the occupying copayer to keep submitting as that party', function() {
    expect(function() {
      assertKeygenPartyOwnership({
        participants: ['alice', 'bob'],
        partyId: 1,
        copayerId: 'bob',
        n: 3
      });
    }).to.not.throw();
  });

  it('rejects a submitter for a slot already claimed by someone else', function() {
    try {
      assertKeygenPartyOwnership({
        participants: ['alice', 'bob'],
        partyId: 1,
        copayerId: 'mallory',
        n: 3
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.code).to.equal(Errors.codes.TSS_NON_PARTICIPANT);
    }
  });

  it('rejects a copayer claiming a second party slot', function() {
    try {
      assertKeygenPartyOwnership({
        participants: ['alice', undefined],
        partyId: 1,
        copayerId: 'alice',
        n: 3
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.code).to.equal(Errors.codes.TSS_MAX_PARTICIPANTS_REACHED);
    }
  });

  it('rejects a partyId outside [0, n)', function() {
    try {
      assertKeygenPartyOwnership({
        participants: ['alice'],
        partyId: 3,
        copayerId: 'bob',
        n: 3
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.code).to.equal(Errors.codes.TSS_INVALID_MESSAGE);
    }
  });
});
