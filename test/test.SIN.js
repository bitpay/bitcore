'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var SIN = bitcore.SIN;

describe('SIN', function() {
  it('should be able to create class', function() {
    should.exist(SIN);
  });
  it('should be able to create instance', function() {
    var s = new SIN();
    should.exist(s);
  });
  it('should be able to convert to string', function() {
    var s = new SIN('6bqov85Hsatqb8eLtwLW1PBQLWVNJkzPwgdAT3SYNkB6X2aF2n');
    s.toString.bind(s).should.not.throw();
  });
  var data = [
    ['6bqov85Hsatqb8eLtwLW1PBQLWVNJkzPwgdAT3SYNkB6X2aF2n', false],
  ];
  data.forEach(function(datum) {
    var sin = datum[0];
    var result = datum[1];
    it('should validate correctly ' + sin, function() {
      var a = new SIN(sin);
      var s = a.toString();

      a.isValid().should.equal(result);
      s.should.equal(a.toString()); // check that validation doesn't change data
    });
  });
});





