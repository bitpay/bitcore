'use strict';

import assert from 'assert';
import sinon from 'sinon';
import { Errors } from '../src/lib/errors';
import { Request, getRequestErrorStatus, isTransientRequestError } from '../src/lib/request';
import { helpers } from './helpers';

describe('Request error status metadata', function() {
  const sandbox = sinon.createSandbox();

  afterEach(function() {
    sandbox.restore();
  });

  const requestWithResponse = (status: number, body: unknown) => new Request('/bws/api', {
    r: helpers.stubRequest(new Error('HTTP failure'), { status, body })
  });

  const defaultMessage = new Errors.INTERNAL_SERVER_ERROR().message;
  for (const [name, body, message, ErrorClass] of [
    ['an empty body', undefined, defaultMessage, Errors.INTERNAL_SERVER_ERROR],
    ['a text body', 'Internal Server Error', defaultMessage, Errors.INTERNAL_SERVER_ERROR],
    ['the BWS error body', { error: 'MongoNetworkError: temporary database connection loss' }, 'MongoNetworkError: temporary database connection loss', Error],
    ['a structured error body', { code: 'INTERNAL_ERROR', message: 'Temporary server failure' }, 'INTERNAL_ERROR: Temporary server failure', Error]
  ] as const) {
    it(`should retain HTTP 500 with ${name} without changing its error class`, async function() {
      const request = requestWithResponse(500, body);
      await assert.rejects(request.get('/test'), err => {
        assert.ok(err instanceof Error);
        assert.equal(err.constructor, ErrorClass);
        assert.equal(err.message, message);
        assert.equal(getRequestErrorStatus(err), 500);
        assert.equal(isTransientRequestError(err), ErrorClass === Errors.INTERNAL_SERVER_ERROR);
        return true;
      });
    });
  }

  it('should preserve the original parsed error, including its class, stack, properties and metadata', async function() {
    const messageData = { reason: 'Temporary server failure' };
    const request = requestWithResponse(500, { code: 'NOT_AUTHORIZED', message: 'Server failure', messageData });
    const parseError = sandbox.spy(Request, '_parseError');
    await assert.rejects(request.get('/test'), err => {
      const original = parseError.firstCall.returnValue;
      assert.strictEqual(err, original);
      assert.equal(err.constructor, Errors.NOT_AUTHORIZED);
      assert.equal(err.message, 'Server failure');
      assert.strictEqual(original.messageData, messageData);
      assert.equal(getRequestErrorStatus(err), 500);
      assert.equal(isTransientRequestError(err), false);
      assert.deepEqual(Object.getOwnPropertyNames(err).sort(), ['message', 'messageData', 'stack']);
      return true;
    });
  });

  it('should retain HTTP status for callback callers while preserving the parsed error', async function() {
    const request = requestWithResponse(500, { error: 'Temporary server failure' });
    const callback = sandbox.spy();
    await request.get('/test', callback);
    assert.equal(callback.callCount, 1);
    const err = callback.firstCall.args[0];
    assert.equal(err.constructor, Error);
    assert.equal(err.message, 'Temporary server failure');
    assert.equal(getRequestErrorStatus(err), 500);
    assert.equal(isTransientRequestError(err), false);
  });

  it('should return no HTTP status for errors or values unrelated to a response', function() {
    for (const value of [new Error('Local failure'), {}, null, undefined, 'error', 500]) {
      assert.equal(getRequestErrorStatus(value), undefined);
    }
  });

  for (const [status, code] of [
    [400, 'TSS_SESSION_EXPIRED'],
    [400, 'TSS_JOIN_DELIVERY_PENDING'],
    [401, 'NOT_AUTHORIZED']
  ] as const) {
    it(`should preserve ${code} from HTTP ${status}`, async function() {
      const request = requestWithResponse(status, { code, message: 'Remote message' });
      await assert.rejects(request.get('/test'), err => {
        assert.ok(err instanceof Errors[code]);
        assert.equal(err.message, 'Remote message');
        assert.equal(getRequestErrorStatus(err), status);
        assert.equal(isTransientRequestError(err), false);
        return true;
      });
    });
  }
});
