export const InvoiceAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'valueSigner',
        type: 'address'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'hash',
        type: 'bytes32'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'tokenContract',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'time',
        type: 'uint256'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256'
      }
    ],
    name: 'PaymentAccepted',
    type: 'event'
  },
  {
    inputs: [],
    name: 'activate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'deactivate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'deactivated',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32'
      }
    ],
    name: 'isPaid',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'gasPrice',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'expiration',
        type: 'uint256'
      },
      {
        internalType: 'bytes32',
        name: 'payload',
        type: 'bytes32'
      },
      {
        internalType: 'bytes32',
        name: 'hash',
        type: 'bytes32'
      },
      {
        internalType: 'uint8',
        name: 'v',
        type: 'uint8'
      },
      {
        internalType: 'bytes32',
        name: 'r',
        type: 'bytes32'
      },
      {
        internalType: 'bytes32',
        name: 's',
        type: 'bytes32'
      },
      {
        internalType: 'address',
        name: 'tokenContract',
        type: 'address'
      }
    ],
    name: 'isValidPayment',
    outputs: [
      {
        internalType: 'bool',
        name: 'valid',
        type: 'bool'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'gasPrice',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'expiration',
        type: 'uint256'
      },
      {
        internalType: 'bytes32',
        name: 'payload',
        type: 'bytes32'
      },
      {
        internalType: 'bytes32',
        name: 'hash',
        type: 'bytes32'
      },
      {
        internalType: 'uint8',
        name: 'v',
        type: 'uint8'
      },
      {
        internalType: 'bytes32',
        name: 'r',
        type: 'bytes32'
      },
      {
        internalType: 'bytes32',
        name: 's',
        type: 'bytes32'
      },
      {
        internalType: 'address',
        name: 'tokenContract',
        type: 'address'
      }
    ],
    name: 'pay',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'quoteSigner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newAdmin',
        type: 'address'
      }
    ],
    name: 'setAdmin',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newQuoteSigner',
        type: 'address'
      }
    ],
    name: 'setSigner',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'gasPrice',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: 'expiration',
        type: 'uint256'
      },
      {
        internalType: 'bytes32',
        name: 'payload',
        type: 'bytes32'
      },
      {
        internalType: 'bytes32',
        name: 'hash',
        type: 'bytes32'
      },
      {
        internalType: 'uint8',
        name: 'v',
        type: 'uint8'
      },
      {
        internalType: 'bytes32',
        name: 'r',
        type: 'bytes32'
      },
      {
        internalType: 'bytes32',
        name: 's',
        type: 'bytes32'
      },
      {
        internalType: 'address',
        name: 'tokenContract',
        type: 'address'
      }
    ],
    name: 'validatePayment',
    outputs: [
      {
        internalType: 'bool',
        name: 'valid',
        type: 'bool'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'tokenContract',
        type: 'address'
      }
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;
