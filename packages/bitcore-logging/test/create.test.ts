import { expect } from 'chai';
import { createLogger, getTransports } from '../src/create';

describe('createLogger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create a logger with console transport', () => {
    const logger = createLogger({ prefix: 'TEST' });
    expect(logger).to.exist;
    expect(logger.info).to.be.a('function');
    expect(logger.error).to.be.a('function');
    expect(logger.debug).to.be.a('function');
    expect(logger.warn).to.be.a('function');
  });

  it('should use defaultLevel when env var is not set', () => {
    delete process.env.TEST_LOG_LEVEL;
    const transports = getTransports({ prefix: 'TEST', defaultLevel: 'warn' });
    expect(transports).to.have.length(1);
    expect((transports[0] as any).level).to.equal('warn');
  });

  it('should default to info when no defaultLevel and no env var', () => {
    delete process.env.TEST_LOG_LEVEL;
    const transports = getTransports({ prefix: 'TEST' });
    expect((transports[0] as any).level).to.equal('info');
  });

  it('should read log level from env var using prefix', () => {
    process.env.TEST_LOG_LEVEL = 'error';
    const transports = getTransports({ prefix: 'TEST' });
    expect((transports[0] as any).level).to.equal('error');
  });

  it('should override to debug when debug flag is true', () => {
    process.env.TEST_LOG_LEVEL = 'error';
    const transports = getTransports({ prefix: 'TEST', debug: true });
    expect((transports[0] as any).level).to.equal('debug');
  });

  it('should only have console transport when no HTTP host set', () => {
    delete process.env.TEST_LOG_HTTP_HOST;
    const transports = getTransports({ prefix: 'TEST' });
    expect(transports).to.have.length(1);
  });

  it('should add HTTP transport when HTTP host is set', () => {
    process.env.TEST_LOG_HTTP_HOST = 'localhost';
    const transports = getTransports({ prefix: 'TEST' });
    expect(transports).to.have.length(2);
  });

  it('should read HTTP port from env var', () => {
    process.env.TEST_LOG_HTTP_HOST = 'localhost';
    process.env.TEST_LOG_HTTP_PORT = '9200';
    const transports = getTransports({ prefix: 'TEST' });
    expect(transports).to.have.length(2);
  });

  it('should work with different prefixes', () => {
    process.env.BCN_LOG_LEVEL = 'debug';
    process.env.BWS_LOG_LEVEL = 'warn';

    const bcnTransports = getTransports({ prefix: 'BCN' });
    const bwsTransports = getTransports({ prefix: 'BWS' });

    expect((bcnTransports[0] as any).level).to.equal('debug');
    expect((bwsTransports[0] as any).level).to.equal('warn');
  });
});
