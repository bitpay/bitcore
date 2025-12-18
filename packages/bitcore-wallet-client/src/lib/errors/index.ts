'use strict';

import { IErrorSpec, errorSpec } from './spec';

class BwcError extends Error {
  name: string;

  constructor() {
    super();
    this.message = 'Internal error';
    this.stack = this.message + '\n' + new Error().stack;
  }
};
BwcError.prototype.name = 'bwc.Error'; // Overrides Error base class name

type BwcErr = typeof BwcError & {
  [key: string]: (new (...args: string[]) => BwcError);
};

function format(message: string, args: string[]): string {
  return message
    .replace('{0}', args[0])
    .replace('{1}', args[1])
    .replace('{2}', args[2]);
};

function traverseNode(parent: typeof BwcError, errorDefinition: IErrorSpec) {
  let messageHandler: (args) => string;
  if (typeof errorDefinition.message === 'string') {
    messageHandler = (args) => format(errorDefinition.message as string, args);
  } else if (typeof errorDefinition.message === 'function') {
    messageHandler = errorDefinition.message;
  } else {
    throw new Error('Invalid error definition for ' + errorDefinition.name);
  }
  class NodeError extends parent {
    name: string;
    message: string;
    stack: string;

    constructor(...args) {
      super();
      this.message = messageHandler(args);
      this.stack = this.message + '\n' + new Error().stack;
    }
  };
  NodeError.prototype.name = parent.prototype.name + errorDefinition.name;
  parent[errorDefinition.name] = NodeError;
  if (errorDefinition.errors) {
    childDefinitions(NodeError, errorDefinition.errors);
  }
  return NodeError;
};

function childDefinitions(parent: typeof BwcError, childDefinitions: IErrorSpec[]) {
  for (const childDefinition of childDefinitions) {
    traverseNode(parent, childDefinition);
  }
};

function traverseRoot(parent: typeof BwcError, errorsDefinition: IErrorSpec[]): BwcErr {
  childDefinitions(parent, errorsDefinition);
  return parent as BwcErr;
};

export const Errors = traverseRoot(BwcError, errorSpec);

export const extend = function(spec) {
  return traverseNode(BwcError, spec);
};
