import { FormattedTransactionType } from 'ripple-lib/dist/npm/transaction/types';
export const RippleTxs = ([
  {
    type: 'payment',
    address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm',
    sequence: 9,
    id: '2AF40DACE9FD4FABEC690F3B54742F50E9A938FF38EFCEA6733B7B7BECBE415E',
    specification: {
      source: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm', maxAmount: { currency: 'XRP', value: '4.492823' } },
      destination: { address: 'rKpTKoJSFbCoZkwydRv7NWTiBgNrdTXJ24' },
      invoiceID: 'F6751F266C7E664CB3CDAE77D091ED73E3D365591D8FA769BEA9F694C5C4A5DF'
    },
    outcome: {
      result: 'tesSUCCESS',
      timestamp: '2020-01-24T19:17:50.000Z',
      fee: '0.000012',
      balanceChanges: {
        rKpTKoJSFbCoZkwydRv7NWTiBgNrdTXJ24: [{ currency: 'XRP', value: '4.492823' }],
        rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '-4.492835' }]
      },
      orderbookChanges: {},
      ledgerVersion: 52960701,
      indexInLedger: 19,
      deliveredAmount: { currency: 'XRP', value: '4.492823' }
    }
  },
  {
    type: 'payment',
    address: 'rLNaPoKeeBjZe2qs6x52yVPZpZ8td4dc6w',
    sequence: 465729,
    id: '81346F435D877B24948AB2EBF2F8F6D98A58DAC36435395B62B38422D3A48FE4',
    specification: {
      source: { address: 'rLNaPoKeeBjZe2qs6x52yVPZpZ8td4dc6w', maxAmount: { currency: 'XRP', value: '42.238648' } },
      destination: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm' }
    },
    outcome: {
      result: 'tesSUCCESS',
      timestamp: '2020-01-21T15:35:50.000Z',
      fee: '0.00004',
      balanceChanges: {
        rLNaPoKeeBjZe2qs6x52yVPZpZ8td4dc6w: [{ currency: 'XRP', value: '-42.238688' }],
        rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '42.238648' }]
      },
      orderbookChanges: {},
      ledgerVersion: 52889891,
      indexInLedger: 16,
      deliveredAmount: { currency: 'XRP', value: '42.238648' }
    }
  },
  {
    type: 'payment',
    address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm',
    sequence: 8,
    id: '6BA909FFC1CFFA080299698B1303E9BF9F5BA78C8DAF939AC4808CE10BF9DFC5',
    specification: {
      source: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm', maxAmount: { currency: 'XRP', value: '10' } },
      destination: { address: 'r9tDMLYTPEj3DX4SmhKW2U8cFApg7RHXZk' }
    },
    outcome: {
      result: 'tesSUCCESS',
      timestamp: '2020-01-17T20:57:50.000Z',
      fee: '0.000012',
      balanceChanges: {
        rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '-10.000012' }],
        r9tDMLYTPEj3DX4SmhKW2U8cFApg7RHXZk: [{ currency: 'XRP', value: '10' }]
      },
      orderbookChanges: {},
      ledgerVersion: 52805982,
      indexInLedger: 22,
      deliveredAmount: { currency: 'XRP', value: '10' }
    }
  },
  {
    type: 'payment',
    address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm',
    sequence: 7,
    id: '4E4758301FBDC47A8881065DF51CC516BDD3738132A568B5A78DCD7CEB00871E',
    specification: {
      source: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm', maxAmount: { currency: 'XRP', value: '14.076233' } },
      destination: { address: 'rsxLvBBjMxnL6nzTHUHVyo8Zw3QuK4NTrn' }
    },
    outcome: {
      result: 'tecNO_DST_INSUF_XRP',
      timestamp: '2020-01-17T20:54:01.000Z',
      fee: '0.000012',
      balanceChanges: { rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '-0.000012' }] },
      orderbookChanges: {},
      ledgerVersion: 52805924,
      indexInLedger: 37
    }
  },
  {
    type: 'payment',
    address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm',
    sequence: 6,
    id: 'BF374F05643E4F4F5E467965BEB83D68FA9D709350D5400CD36701ECA645E9E8',
    specification: {
      source: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm', maxAmount: { currency: 'XRP', value: '14.076245' } },
      destination: { address: 'rsxLvBBjMxnL6nzTHUHVyo8Zw3QuK4NTrn' }
    },
    outcome: {
      result: 'tecNO_DST_INSUF_XRP',
      timestamp: '2020-01-17T20:53:12.000Z',
      fee: '0.000012',
      balanceChanges: { rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '-0.000012' }] },
      orderbookChanges: {},
      ledgerVersion: 52805912,
      indexInLedger: 18
    }
  },
  {
    type: 'payment',
    address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm',
    sequence: 5,
    id: '2C36DF881E7DCB91F469BF64E4931EE546322143D7FDEAC6DA164356A772D8AC',
    specification: {
      source: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm', maxAmount: { currency: 'XRP', value: '1' } },
      destination: { address: 'rEqj9WKSH7wEkPvWf6b4gCi26Y3F7HbKUF' }
    },
    outcome: {
      result: 'tesSUCCESS',
      timestamp: '2020-01-10T22:08:40.000Z',
      fee: '0.000012',
      balanceChanges: {
        rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '-1.000012' }],
        rEqj9WKSH7wEkPvWf6b4gCi26Y3F7HbKUF: [{ currency: 'XRP', value: '1' }]
      },
      orderbookChanges: {},
      ledgerVersion: 52650425,
      indexInLedger: 16,
      deliveredAmount: { currency: 'XRP', value: '1' }
    }
  },
  {
    type: 'payment',
    address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm',
    sequence: 4,
    id: '87D9B5A01108424521AB8CEAFCA5736D2B254F6F2305C91BF5EBB83A64987834',
    specification: {
      source: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm', maxAmount: { currency: 'XRP', value: '1' } },
      destination: { address: 'r9tDMLYTPEj3DX4SmhKW2U8cFApg7RHXZk' }
    },
    outcome: {
      result: 'tesSUCCESS',
      timestamp: '2020-01-10T21:52:32.000Z',
      fee: '0.000012',
      balanceChanges: {
        rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '-1.000012' }],
        r9tDMLYTPEj3DX4SmhKW2U8cFApg7RHXZk: [{ currency: 'XRP', value: '1' }]
      },
      orderbookChanges: {},
      ledgerVersion: 52650171,
      indexInLedger: 8,
      deliveredAmount: { currency: 'XRP', value: '1' }
    }
  },
  {
    type: 'payment',
    address: 'r9tDMLYTPEj3DX4SmhKW2U8cFApg7RHXZk',
    sequence: 1,
    id: 'DC3EA31DED91E5CEFD3204855BE585EE4529C1C482634241B4F8C4303A0296BB',
    specification: {
      source: { address: 'r9tDMLYTPEj3DX4SmhKW2U8cFApg7RHXZk', maxAmount: { currency: 'XRP', value: '1' } },
      destination: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm' }
    },
    outcome: {
      result: 'tesSUCCESS',
      timestamp: '2020-01-10T21:39:02.000Z',
      fee: '0.000012',
      balanceChanges: {
        rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '1' }],
        r9tDMLYTPEj3DX4SmhKW2U8cFApg7RHXZk: [{ currency: 'XRP', value: '-1.000012' }]
      },
      orderbookChanges: {},
      ledgerVersion: 52649960,
      indexInLedger: 7,
      deliveredAmount: { currency: 'XRP', value: '1' }
    }
  },
  {
    type: 'payment',
    address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm',
    sequence: 3,
    id: '5D2C1A96F5D9C9F359089830A527137C1A2BFBAF0F996059E6B0CCDD2BB9D5AF',
    specification: {
      source: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm', maxAmount: { currency: 'XRP', value: '1' } },
      destination: { address: 'r9tDMLYTPEj3DX4SmhKW2U8cFApg7RHXZk' }
    },
    outcome: {
      result: 'tecNO_DST_INSUF_XRP',
      timestamp: '2020-01-10T21:17:20.000Z',
      fee: '0.000012',
      balanceChanges: { rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '-0.000012' }] },
      orderbookChanges: {},
      ledgerVersion: 52649616,
      indexInLedger: 29
    }
  },
  {
    type: 'payment',
    address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm',
    sequence: 2,
    id: 'BFF02EF98C13F011F73D36504458AFF5576B5FB4A870C5699DDDEC6755CA00C8',
    specification: {
      source: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm', maxAmount: { currency: 'XRP', value: '1' } },
      destination: { address: 'r9tDMLYTPEj3DX4SmhKW2U8cFApg7RHXZk' }
    },
    outcome: {
      result: 'tecNO_DST_INSUF_XRP',
      timestamp: '2020-01-10T18:18:31.000Z',
      fee: '0.000012',
      balanceChanges: { rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '-0.000012' }] },
      orderbookChanges: {},
      ledgerVersion: 52646823,
      indexInLedger: 29
    }
  },
  {
    type: 'payment',
    address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm',
    sequence: 1,
    id: '6EB25C965056F8F004C83CF2D731A6BA17594D5FD17166C29C6A0DF977D64849',
    specification: {
      source: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm', maxAmount: { currency: 'XRP', value: '4.923683' } },
      destination: { address: 'rKpTKoJSFbCoZkwydRv7NWTiBgNrdTXJ24' },
      invoiceID: 'CA97FA86465F1D9B551FC9326D53315D4D171D2AE9792F4ED255D3CE539BA6CC'
    },
    outcome: {
      result: 'tesSUCCESS',
      timestamp: '2020-01-09T16:51:00.000Z',
      fee: '0.000012',
      balanceChanges: {
        rKpTKoJSFbCoZkwydRv7NWTiBgNrdTXJ24: [{ currency: 'XRP', value: '4.923683' }],
        rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '-4.923695' }]
      },
      orderbookChanges: {},
      ledgerVersion: 52623307,
      indexInLedger: 0,
      deliveredAmount: { currency: 'XRP', value: '4.923683' }
    }
  },
  {
    type: 'payment',
    address: 'rLNaPoKeeBjZe2qs6x52yVPZpZ8td4dc6w',
    sequence: 444151,
    id: '7DDB2FF110CC94E1C21DAD6C56FE03792B38A6ECB2BC79B53F2BFB224AFDBE0F',
    specification: {
      source: { address: 'rLNaPoKeeBjZe2qs6x52yVPZpZ8td4dc6w', maxAmount: { currency: 'XRP', value: '40' } },
      destination: { address: 'rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm' }
    },
    outcome: {
      result: 'tesSUCCESS',
      timestamp: '2020-01-09T16:47:50.000Z',
      fee: '0.00004',
      balanceChanges: {
        rLNaPoKeeBjZe2qs6x52yVPZpZ8td4dc6w: [{ currency: 'XRP', value: '-40.00004' }],
        rN33DVnneYUUgTmcxXnXvgAL1BECuLZ8pm: [{ currency: 'XRP', value: '40' }]
      },
      orderbookChanges: {},
      ledgerVersion: 52623260,
      indexInLedger: 101,
      deliveredAmount: { currency: 'XRP', value: '40' }
    }
  }
] as any) as Array<FormattedTransactionType>;
