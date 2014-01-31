'use strict';


var expect = chai.expect;
var should = chai.should();

describe('Initialization of bitcore', function() {
  it('should initialze the main object', function() {
    should.exist(bitcore);
  });
});
