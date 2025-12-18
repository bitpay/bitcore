import supertest from 'supertest';
import { expect } from 'chai';
import app from '../../../src/routes';

describe('Validate Route', function() {
  const request = supertest(app);
  
  it('should detect valid block height', done => {
    request.get('/api/BTC/regtest/valid/100000')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { isValid, type } = res.body;
        expect(isValid).to.be.true;
        expect(type).to.equal('blockOrTx');
        done();
      });
  });

  it('should detect valid block hash', done => {
    request.get('/api/BTC/regtest/valid/4fedb28fb20b5dcfe4588857ac10c38c6d67e8267e35478d8bcca468c9114bbe')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { isValid, type } = res.body;
        expect(isValid).to.be.true;
        expect(type).to.equal('blockOrTx');
        done();
      });
  });

  it('should detect invalid block hash when length < 64', done => {
    request.get('/api/BTC/regtest/valid/4fedb28fb20b5dcfe4588857ac10c38c6d67e8267e35478d8bcca468c9114bb')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { isValid, type } = res.body;
        expect(isValid).to.be.false;
        expect(type).to.equal('invalid');
        done();
      });
  });
  
  it('should detect invalid block hash when length > 64', done => {
    request.get('/api/BTC/regtest/valid/4fedb28fb20b5dcfe4588857ac10c38c6d67e8267e35478d8bcca468c9114bbee')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { isValid, type } = res.body;
        expect(isValid).to.be.false;
        expect(type).to.equal('invalid');
        done();
      });
  });

  it('should detect valid bitcoin address', done => {
    request.get('/api/BTC/regtest/valid/bcrt1qqf8mswxuh4fgv27e47lekxxt0jgp373zg85jk4')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { isValid, type } = res.body;
        expect(isValid).to.be.true;
        expect(type).to.equal('addr');
        done();
      });
  });

  it('should detect invalid bitcoin address', done => {
    request.get('/api/BTC/regtest/valid/bcrt1qqf8mswxuh4fgv27e47lekxxt0jgp373zg85jk44')
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { isValid, type } = res.body;
        expect(isValid).to.be.false;
        expect(type).to.equal('invalid');
        done();
      });
  });   
});