'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Utils = require('../lib/common/utils');

describe('Utils', function() {
  describe('#checkRequired', function() {
    it('should check required fields', function() {
      var obj = {
        id: 'id',
        name: 'name',
        array: ['a', 'b'],
      };
      var fixtures = [{
        args: 'id',
        check: true
      }, {
        args: ['id'],
        check: true
      }, {
        args: ['id, name'],
        check: false
      }, {
        args: ['id', 'name'],
        check: true
      }, {
        args: 'array',
        check: true
      }, {
        args: 'dummy',
        check: false
      }, {
        args: ['dummy1', 'dummy2'],
        check: false
      }, {
        args: ['id', 'dummy'],
        check: false
      }, ];
      _.each(fixtures, function(f) {
        Utils.checkRequired(obj, f.args).should.equal(f.check);
      });
    });
    it('should fail to check required fields on non-object', function() {
      var obj = 'dummy';
      Utils.checkRequired(obj, 'name').should.be.false;
    });
  });
});
