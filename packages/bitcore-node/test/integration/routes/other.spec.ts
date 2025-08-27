import supertest from 'supertest';
import app from '../../../src/routes';

const request = supertest(app);

describe('Block Routes', function() {
  before(async function() {
    this.timeout(15000);
  });

  it('should respond with a 404 status code for an unknown path', done => {
    request.get('/unknown').expect(404, done);
  });
});
