import { expect } from 'chai';
import { consoleFormat, httpFormat } from '../src/formatters';

describe('consoleFormat', () => {
  it('should return a valid Winston format', () => {
    const format = consoleFormat();
    expect(format).to.exist;
    expect(format.transform).to.be.a('function');
  });

  it('should produce a formatted string from an info object', () => {
    const format = consoleFormat();
    const info = { level: 'info', message: 'hello', [Symbol.for('level')]: 'info' } as any;
    const result = format.transform(info, {});
    expect(result).to.not.be.false;
    const output = result[Symbol.for('message')] as string;
    expect(output).to.include('hello');
  });

  it('should JSON-stringify object messages as fallback', () => {
    const format = consoleFormat();
    const obj = { foo: 'bar' };
    const info = { level: 'info', message: obj, [Symbol.for('level')]: 'info' } as any;
    format.transform(info, {});
    expect(typeof info.message).to.equal('string');
    expect(info.message).to.include('foo');
  });
});

describe('httpFormat', () => {
  it('should return a valid Winston format', () => {
    const format = httpFormat('my-tag');
    expect(format).to.exist;
    expect(format.transform).to.be.a('function');
  });

  it('should include the tag in JSON output', () => {
    const format = httpFormat('my-tag');
    const info = { level: 'info', message: 'hello', [Symbol.for('level')]: 'info' } as any;
    const result = format.transform(info, {});
    expect(result).to.not.be.false;
    const output = result[Symbol.for('message')] as string;
    const parsed = JSON.parse(output);
    expect(parsed.tag).to.equal('my-tag');
    expect(parsed.message).to.equal('hello');
  });

  it('should JSON-stringify object messages as fallback', () => {
    const format = httpFormat('my-tag');
    const obj = { foo: 'bar' };
    const info = { level: 'warn', message: obj, [Symbol.for('level')]: 'warn' } as any;
    format.transform(info, {});
    expect(typeof info.message).to.equal('string');
    expect(info.message).to.include('foo');
  });
});
