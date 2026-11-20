'use strict';

function format(message, args) {
  return message
    .replace('{0}', args[0])
    .replace('{1}', args[1])
    .replace('{2}', args[2]);
}
const traverseNode = function(parent, errorDefinition) {
  const NodeError = function() {
    if (typeof errorDefinition.message === 'string') {
      this.message = format(errorDefinition.message, arguments);
    } else if (typeof errorDefinition.message === 'function') {
      this.message = errorDefinition.message.apply(null, arguments);
    } else {
      throw new Error('Invalid error definition for ' + errorDefinition.name);
    }
    this.stack = this.message + '\n' + (new Error()).stack;
  };
  NodeError.prototype = Object.create(parent.prototype);
  NodeError.prototype.name = parent.prototype.name + errorDefinition.name;
  parent[errorDefinition.name] = NodeError;
  if (errorDefinition.errors) {
    childDefinitions(NodeError, errorDefinition.errors);
  }
  return NodeError;
};

/* jshint latedef: false */
const childDefinitions = function(parent, childDefinitions) {
  for (const childDef of childDefinitions) {
    traverseNode(parent, childDef);
  }
};
/* jshint latedef: true */

const traverseRoot = function(parent, errorsDefinition) {
  childDefinitions(parent, errorsDefinition);
  return parent;
};


const bitcore = {};
bitcore.Error = function() {
  this.message = 'Internal error';
  this.stack = this.message + '\n' + (new Error()).stack;
};
bitcore.Error.prototype = Object.create(Error.prototype);
bitcore.Error.prototype.name = 'bitcore.Error';


const data = require('./spec');

traverseRoot(bitcore.Error, data);

module.exports = bitcore.Error;

module.exports.extend = function(spec) {
  return traverseNode(bitcore.Error, spec);
};
