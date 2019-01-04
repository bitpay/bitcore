import { async, inject, TestBed } from '@angular/core/testing';
import {
  BaseRequestOptions,
  Http,
  HttpModule,
  Response,
  ResponseOptions
} from '@angular/http';
import { MockBackend } from '@angular/http/testing';
import { CurrencyProvider } from '../../providers/currency/currency';
import { DefaultProvider } from '../../providers/default/default';
import { ApiProvider } from '../api/api';
import { AppBlock, BlocksProvider } from './blocks';

describe('Blocks Provider', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [],
      providers: [
        BlocksProvider,
        ApiProvider,
        CurrencyProvider,
        DefaultProvider,
        MockBackend,
        BaseRequestOptions,
        {
          provide: Http,
          useFactory: (mockBackend, options) => {
            return new Http(mockBackend, options);
          },
          deps: [MockBackend, BaseRequestOptions]
        }
      ],

      imports: [HttpModule]
    });
  }));

  it('should get blocks', inject(
    [BlocksProvider, MockBackend],
    (blocksProvider, mockBackend) => {
      const mockResponse = `
[
  {
    "height": 1995,
    "size": 228,
    "virtualSize": 228,
    "merkleroot": "dea3cbc41c22fc8bc7be8df6a1c6d5fdd03b9552380fc7c706330499e33473f2",
    "version": 536870912,
    "difficulty": 0.8924278844180985,
    "bits": "207fffff",
    "hash": "0ac5a5411586fd157bb5ccd60d1d367133ef66bf86d1bd409df636c221c369be",
    "time": 1528480720,
    "tx": {
      "length": 1
    },
    "txlength": 1,
    "previousblockhash": "2eae76b2f9ee09171333e1f9d1d85395441b2f2a93e3195787ccf4dca88cc9ca",
    "nextblockhash": "6c3a9505a47edca2aba0764e0c33ab7e720dc9f64f22f61da3d228fe028f134c",
    "poolInfo": {
      "url": ""
    },
    "reward": 0.00610351
  },
  {
    "height": 1994,
    "size": 228,
    "virtualSize": 228,
    "merkleroot": "6d81732bd2322c7518ffd122d1754ae1d24cd7d570325628a1fbc927752fad51",
    "version": 536870912,
    "difficulty": 0.8924278844180985,
    "bits": "207fffff",
    "hash": "2eae76b2f9ee09171333e1f9d1d85395441b2f2a93e3195787ccf4dca88cc9ca",
    "time": 1528480720,
    "tx": {
      "length": 1
    },
    "txlength": 1,
    "previousblockhash": "24982fc7ec9c45a4240d86441abd14512eeb4fd6c4f3a4ded08c93ae5124ccf9",
    "nextblockhash": "0ac5a5411586fd157bb5ccd60d1d367133ef66bf86d1bd409df636c221c369be",
    "poolInfo": {
      "url": ""
    },
    "reward": 0.00610351
  },
  {
    "height": 1993,
    "size": 228,
    "virtualSize": 228,
    "merkleroot": "9d22364c19f731eacd366d2fd72f7c40d35cb9c03c664c9c37f441d6c5c4a171",
    "version": 536870912,
    "difficulty": 0.8924278844180985,
    "bits": "207fffff",
    "hash": "24982fc7ec9c45a4240d86441abd14512eeb4fd6c4f3a4ded08c93ae5124ccf9",
    "time": 1528480720,
    "tx": {
      "length": 1
    },
    "txlength": 1,
    "previousblockhash": "7ee40ebc7674f368178191ccd3cf15003fa7ec7e957d2a6d5b78984059cf4529",
    "nextblockhash": "2eae76b2f9ee09171333e1f9d1d85395441b2f2a93e3195787ccf4dca88cc9ca",
    "poolInfo": {
      "url": ""
    },
    "reward": 0.00610351
  }
]`;

      mockBackend.connections.subscribe(connection => {
        connection.mockRespond(
          new Response(
            new ResponseOptions({
              body: mockResponse
            })
          )
        );
      });

      blocksProvider.getBlocks().subscribe(response => {
        const blocks: AppBlock[] = response.blocks;

        expect(Array.isArray(blocks)).toBeTruthy();
        expect(blocks.length).toBeGreaterThan(0);
        expect(blocks.length).toBe(3);
      });
    }
  ));
});
