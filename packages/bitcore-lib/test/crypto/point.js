'use strict';

var should = require('chai').should();
var bitcore = require('../..');
var Point = bitcore.crypto.Point;
var BN = bitcore.crypto.BN;

describe('Point', function() {

  var valid = {
    x: 'ac242d242d23be966085a2b2b893d989f824e06c9ad0395a8a52f055ba39abb2',
    y: '4836ab292c105a711ed10fcfd30999c31ff7c02456147747e03e739ad527c380',
  };

  var invalidPair = {
    x: 'ac242d242d23be966085a2b2b893d989f824e06c9ad0395a8a52f055ba39abb2',
    y: '0000000000000000000000000000000000000000000000000000000000000000',
  };
  
  it('should create a point', function() {
    var p = Point(valid.x, valid.y);
    should.exist(p);
  });
  
  it('should create a point when called with "new"', function() {
    var p = new Point(valid.x,valid.y);
    should.exist(p);
  });

  describe('#getX', function() {
    
    it('should return x', function() {
      var p = Point(valid.x,valid.y);
      var x = p.getX();
      x.toString('hex', 64).should.equal(valid.x);
    });

    it('should be convertable to a buffer', function() {
      var p = Point(valid.x,valid.y);
      var a = p.getX().toBuffer({size: 32});
      a.length.should.equal(32);
      a.should.deep.equal(new Buffer(valid.x, 'hex'));
    });

  });

  describe('#getY', function() {
    
    it('should return y', function() {
      var p = Point(valid.x,valid.y);
      p.getY().toString('hex', 64).should.equal(valid.y);
    });

    it('should be convertable to a buffer', function() {
      var p = Point(valid.x,valid.y);
      var a = p.getY().toBuffer({size: 32});
      a.length.should.equal(32);
      a.should.deep.equal(new Buffer(valid.y, 'hex'));
    });

  });

  describe('#add', function() {

    it('should accurately add g to itself', function() {
      var p1 = Point.getG();
      var p2 = Point.getG();
      var p3 = p1.add(p2);
      p3.getX().toString().should.equal('89565891926547004231252920425935692360644145829622209'+
                                        '833684329913297188986597');
      p3.getY().toString().should.equal('12158399299693830322967808612713398636155367887041628'+
                                        '176798871954788371653930');
    });

  });

  describe('#mul', function() {

    it('should accurately multiply g by 2', function() {
      var g = Point.getG();
      var b = g.mul(new BN(2));
      b.getX().toString().should.equal('8956589192654700423125292042593569236064414582962220983'+
                                       '3684329913297188986597');
      b.getY().toString().should.equal('1215839929969383032296780861271339863615536788704162817'+
                                       '6798871954788371653930');
    });

    it('should accurately multiply g by n-1', function() {
      var g = Point.getG();
      var n = Point.getN();
      var b = g.mul(n.sub(new BN(1)));
      b.getX().toString().should.equal('55066263022277343669578718895168534326250603453777594175'+
                                       '500187360389116729240');
      b.getY().toString().should.equal('83121579216557378445487899878180864668798711284981320763'+
                                       '518679672151497189239');
    });

    //not sure if this is technically accurate or not...
    //normally, you should always multiply g by something less than n
    //but it is the same result in OpenSSL
    it('should accurately multiply g by n+1', function() {
      var g = Point.getG();
      var n = Point.getN();
      var b = g.mul(n.add(new BN(1)));
      b.getX().toString().should.equal('550662630222773436695787188951685343262506034537775941755'+
                                       '00187360389116729240');
      b.getY().toString().should.equal('326705100207588169780830851305070431844712733806592432759'+
                                       '38904335757337482424');
    });

  });

  describe('@fromX', function() {
    
    it('should return g', function() {
      var g = Point.getG();
      var p = Point.fromX(false, g.getX());
      g.eq(p).should.equal(true);
    });

  });

  describe('#validate', function() {

    it('should describe this point as valid', function() {
      var p = Point(valid.x, valid.y);
      should.exist(p.validate());
    });

    it('should describe this point as invalid because of zero y', function() {
      var x = 'ac242d242d23be966085a2b2b893d989f824e06c9ad0395a8a52f055ba39abb2';
      var y = '0000000000000000000000000000000000000000000000000000000000000000';
      (function() {
        var p = Point(x, y);
      }).should.throw('Invalid y value for curve.');
    });


    it('should describe this point as invalid because of invalid y', function() {
      var x = 'ac242d242d23be966085a2b2b893d989f824e06c9ad0395a8a52f055ba39abb2';
      var y = '00000000000000000000000000000000000000000000000000000000000000FF';
      (function() {
        var p = Point(x, y);
      }).should.throw('Invalid y value for curve.');
    });


    it('should describe this point as invalid because out of curve bounds', function() {

      // point larger than max
      var x = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEDCE6AF48A03BBFD25E8CD0364141';
      // calculated y of x
      var y = 'ed3970f129bc2ca7c7c6cf92fa7da4de6a1dfc9c14da4bf056aa868d3dd74034';

      (function() {
        // set the point
        var p = Point(x, y);
      }).should.throw('Point does not lie on the curve');
    });

    it('should describe this point as invalid because out of curve bounds', function() {

      var x = '0000000000000000000000000000000000000000000000000000000000000000';

      (function() {
        // set the point
        var p = Point.fromX(false, x);
      }).should.throw('Invalid X');
    });

  });

});
