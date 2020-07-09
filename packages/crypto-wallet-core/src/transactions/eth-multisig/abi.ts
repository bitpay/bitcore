export const MultisigAbi = [
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    name: 'isInstantiation',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: false,
    inputs: [
      {
        name: '_owners',
        type: 'address[]'
      },
      {
        name: '_required',
        type: 'uint256'
      },
      {
        name: '_dailyLimit',
        type: 'uint256'
      }
    ],
    name: 'create',
    outputs: [
      {
        name: 'wallet',
        type: 'address'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'address'
      },
      {
        name: '',
        type: 'uint256'
      }
    ],
    name: 'instantiations',
    outputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [
      {
        name: 'creator',
        type: 'address'
      }
    ],
    name: 'getInstantiationCount',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        name: 'sender',
        type: 'address'
      },
      {
        indexed: false,
        name: 'instantiation',
        type: 'address'
      }
    ],
    name: 'ContractInstantiation',
    type: 'event'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    name: 'owners',
    outputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'owner',
        type: 'address'
      }
    ],
    name: 'removeOwner',
    outputs: [],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'revokeConfirmation',
    outputs: [],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'address'
      }
    ],
    name: 'isOwner',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'uint256'
      },
      {
        name: '',
        type: 'address'
      }
    ],
    name: 'confirmations',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [],
    name: 'calcMaxWithdraw',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [
      {
        name: 'pending',
        type: 'bool'
      },
      {
        name: 'executed',
        type: 'bool'
      }
    ],
    name: 'getTransactionCount',
    outputs: [
      {
        name: 'count',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [],
    name: 'dailyLimit',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [],
    name: 'lastDay',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'owner',
        type: 'address'
      }
    ],
    name: 'addOwner',
    outputs: [],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    inputs: [
      {
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'isConfirmed',
    outputs: [
      {
        name: '',
        type: 'bool'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [
      {
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'getConfirmationCount',
    outputs: [
      {
        name: 'count',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    name: 'transactions',
    outputs: [
      {
        name: 'destination',
        type: 'address'
      },
      {
        name: 'value',
        type: 'uint256'
      },
      {
        name: 'data',
        type: 'bytes'
      },
      {
        name: 'executed',
        type: 'bool'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [],
    name: 'getOwners',
    outputs: [
      {
        name: '',
        type: 'address[]'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [
      {
        name: 'from',
        type: 'uint256'
      },
      {
        name: 'to',
        type: 'uint256'
      },
      {
        name: 'pending',
        type: 'bool'
      },
      {
        name: 'executed',
        type: 'bool'
      }
    ],
    name: 'getTransactionIds',
    outputs: [
      {
        name: '_transactionIds',
        type: 'uint256[]'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [
      {
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'getConfirmations',
    outputs: [
      {
        name: '_confirmations',
        type: 'address[]'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [],
    name: 'transactionCount',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: false,
    inputs: [
      {
        name: '_required',
        type: 'uint256'
      }
    ],
    name: 'changeRequirement',
    outputs: [],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'confirmTransaction',
    outputs: [],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'destination',
        type: 'address'
      },
      {
        name: 'value',
        type: 'uint256'
      },
      {
        name: 'data',
        type: 'bytes'
      }
    ],
    name: 'submitTransaction',
    outputs: [
      {
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    inputs: [
      {
        name: '_dailyLimit',
        type: 'uint256'
      }
    ],
    name: 'changeDailyLimit',
    outputs: [],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    inputs: [],
    name: 'MAX_OWNER_COUNT',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: true,
    inputs: [],
    name: 'required',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'owner',
        type: 'address'
      },
      {
        name: 'newOwner',
        type: 'address'
      }
    ],
    name: 'replaceOwner',
    outputs: [],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    inputs: [
      {
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'executeTransaction',
    outputs: [],
    payable: false,
    type: 'function',
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    inputs: [],
    name: 'spentToday',
    outputs: [
      {
        name: '',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'function',
    stateMutability: 'view'
  },
  {
    inputs: [
      {
        name: '_owners',
        type: 'address[]'
      },
      {
        name: '_required',
        type: 'uint256'
      },
      {
        name: '_dailyLimit',
        type: 'uint256'
      }
    ],
    payable: false,
    type: 'constructor',
    stateMutability: 'nonpayable'
  },
  {
    payable: true,
    type: 'fallback',
    stateMutability: 'payable'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        name: 'dailyLimit',
        type: 'uint256'
      }
    ],
    name: 'DailyLimitChange',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'sender',
        type: 'address'
      },
      {
        indexed: true,
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'Confirmation',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'sender',
        type: 'address'
      },
      {
        indexed: true,
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'Revocation',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'Submission',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'Execution',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'transactionId',
        type: 'uint256'
      }
    ],
    name: 'ExecutionFailure',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'sender',
        type: 'address'
      },
      {
        indexed: false,
        name: 'value',
        type: 'uint256'
      }
    ],
    name: 'Deposit',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'owner',
        type: 'address'
      }
    ],
    name: 'OwnerAddition',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'owner',
        type: 'address'
      }
    ],
    name: 'OwnerRemoval',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        name: 'required',
        type: 'uint256'
      }
    ],
    name: 'RequirementChange',
    type: 'event'
  }
];
