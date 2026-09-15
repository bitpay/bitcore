'use strict';

import 'chai/register-should';
import * as sinon from 'sinon';
import * as chai from 'chai';
import io from 'socket.io-client';
import logger from '../src/lib/logger';
import { MessageBroker } from '../src/lib/messagebroker';
import type { INotification } from '../src/lib/model/notification';

const should = chai.should();

describe('MessageBroker', function() {
  const sandbox = sinon.createSandbox();
  const opts = {
    messageBrokerServer: {
      url: 'http://dummy:3380'
    }
  };

  beforeEach(function() {
    sandbox.stub(io, 'connect').returns({
      on: sandbox.stub(),
      emit: sandbox.stub()
    });
    sandbox.stub(logger, 'info');
    sandbox.stub(logger, 'warn');
    sandbox.stub(logger, 'error');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('#constructor', function() {
    it('should create a local MessageBroker instance without opts', function() {
      const mb = new MessageBroker(null);
      mb.should.be.instanceof(MessageBroker);
      should.not.exist(mb.mq);
      mb.remote.should.equal(false);
    });

    it('should create a fleshed out MessageBroker instance', function() {
      const mb = new MessageBroker(opts);
      mb.should.be.instanceof(MessageBroker);
      should.exist(mb.mq);
      mb.remote.should.equal(true);
      const onStub = mb.mq.on as sinon.SinonStub;
      onStub.callCount.should.equal(3);
      onStub.getCall(0).args[0].should.equal('connect');
      onStub.getCall(1).args[0].should.equal('connect_error');
      onStub.getCall(2).args[0].should.equal('msg');
      (logger.info as sinon.SinonStub).callCount.should.equal(1);
    });
  });

  describe('#send', function() {
    it('should emit a message when remote is false', function() {
      const mb = new MessageBroker(null);
      const emitSpy = sandbox.spy(mb, 'emit');
      const data = { type: 'test' };
      mb.send(data as INotification);
      emitSpy.calledOnce.should.equal(true);
      emitSpy.calledWith('msg', data).should.equal(true);
    });

    it('should emit a message when remote is true', function() {
      const mb = new MessageBroker(opts);
      const emitSpy = mb.mq.emit as sinon.SinonSpy;
      const data = { type: 'test' };
      mb.send(data as INotification);
      emitSpy.calledOnce.should.equal(true);
      emitSpy.calledWith('msg', data).should.equal(true);
    });
  });

  describe('#onMessage', function() {
    it('should register a message handler', function() {
      const mb = new MessageBroker(null);
      const handler = sandbox.stub();
      mb.onMessage(handler);
      mb.emit('msg', { type: 'test' });
      handler.calledOnce.should.equal(true);
    });

    it('should register multiple message handlers', function() {
      const mb = new MessageBroker(null);
      const handler1 = sandbox.stub();
      const handler2 = sandbox.stub();
      mb.onMessage(handler1);
      mb.onMessage(handler2);
      mb.emit('msg', { type: 'test' });
      handler1.calledOnce.should.equal(true);
      handler2.calledOnce.should.equal(true);
    });

    it('should register the same handler twice', function() {
      const mb = new MessageBroker(null);
      const handler = sandbox.stub();
      mb.onMessage(handler);
      mb.onMessage(handler);
      mb.emit('msg', { type: 'test' });
      handler.calledTwice.should.equal(true);
    });
  });

  describe('#offMessage', function() {
    it('should unregister a message handler', function() {
      const mb = new MessageBroker(null);
      const handler = sandbox.stub();
      mb.onMessage(handler);
      mb.offMessage(handler);
      mb.emit('msg', { type: 'test' });
      handler.called.should.equal(false);
    });

    it('should unregister a message handler closure', function() {
      const mb = new MessageBroker(null);
      const closure = sandbox.stub();
      const handler = (message: INotification) => {
        closure(message);
      };

      // Register the same closure more than once.
      mb.onMessage(handler);
      mb.onMessage(handler);
      mb.listeners('msg').length.should.equal(2);

      // Unsubscribe should remove only one instance of the same closure.
      mb.offMessage(handler);
      mb.listeners('msg').length.should.equal(1);

      mb.emit('msg', { type: 'test' });
      closure.calledOnce.should.equal(true);
    });
  });
});
