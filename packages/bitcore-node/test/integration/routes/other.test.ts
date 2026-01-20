import supertest from 'supertest';
import app from '../../../src/routes';


describe('Routes', function() {
  const request = supertest(app);
  
  before(async function() {
    this.timeout(15000);
  });

  it('should respond with a 404 status code for an unknown path', done => {
    request.get('/unknown').expect(404, done);
  });
});
