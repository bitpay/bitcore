var should = require('chai').should();
var point = require('../lib/point');
var BN = require('../lib/bn');

describe('Point', function() {
  
  it('should create a point', function() {
    var p = point();
    should.exist(p);
  });
  
  it('should create a point when called with "new"', function() {
    var p = new point();
    should.exist(p);
  });

  describe('#getX', function() {
    
    it('should return 0', function() {
      var p = point();
      p.getX().toString().should.equal('0');
    });

    it('should be convertable to a buffer', function() {
      var p = point();
      p.getX().toBuffer({size: 32}).length.should.equal(32);
    });

  });

  describe('#getY', function() {
    
    it('should return 0', function() {
      var p = point();
      p.getY().toString().should.equal('0');
    });

    it('should be convertable to a buffer', function() {
      var p = point();
      p.getY().toBuffer({size: 32}).length.should.equal(32);
    });

  });

  describe('#add', function() {

    it('should accurately add g to itself', function() {
      var p1 = point.getG();
      var p2 = point.getG();
      var p3 = p1.add(p2);
      p3.getX().toString().should.equal('89565891926547004231252920425935692360644145829622209833684329913297188986597');
      p3.getY().toString().should.equal('12158399299693830322967808612713398636155367887041628176798871954788371653930');
    });

  });

  describe('#mul', function() {

    it('should accurately multiply g by 2', function() {
      var g = point.getG();
      var b = g.mul(BN(2));
      b.getX().toString().should.equal('89565891926547004231252920425935692360644145829622209833684329913297188986597');
      b.getY().toString().should.equal('12158399299693830322967808612713398636155367887041628176798871954788371653930');
    });

    it('should accurately multiply g by n-1', function() {
      var g = point.getG();
      var n = point.getN();
      var b = g.mul(n.sub(1));
      b.getX().toString().should.equal('55066263022277343669578718895168534326250603453777594175500187360389116729240');
      b.getY().toString().should.equal('83121579216557378445487899878180864668798711284981320763518679672151497189239');
    });

    //not sure if this is technically accurate or not...
    //normally, you should always multiply g by something less than n
    //but it is the same result in OpenSSL
    it('should accurately multiply g by n+1', function() {
      var g = point.getG();
      var n = point.getN();
      var b = g.mul(n.add(1));
      b.getX().toString().should.equal('55066263022277343669578718895168534326250603453777594175500187360389116729240');
      b.getY().toString().should.equal('32670510020758816978083085130507043184471273380659243275938904335757337482424');
    });

  });

  describe('@fromX', function() {
    
    it('should return g', function() {
      var g = point.getG();
      var p = point.fromX(false, g.getX());
      g.eq(p).should.equal(true);
    });

  });

  describe('#validate', function() {

    it('should validate this valid point', function() {
      var x = BN().fromBuffer(new Buffer('ac242d242d23be966085a2b2b893d989f824e06c9ad0395a8a52f055ba39abb2', 'hex'));
      var y = BN().fromBuffer(new Buffer('4836ab292c105a711ed10fcfd30999c31ff7c02456147747e03e739ad527c380', 'hex'));
      var p = point(x, y);
      should.exist(p.validate());
    });

    it('should invalidate this invalid point', function() {
      var x = BN().fromBuffer(new Buffer('ac242d242d23be966085a2b2b893d989f824e06c9ad0395a8a52f055ba39abb2', 'hex'));
      var y = BN().fromBuffer(new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));
      var p = point(x, y);
      (function() {
        p.validate();
      }).should.throw('Invalid y value of public key');
    });

  });

});
