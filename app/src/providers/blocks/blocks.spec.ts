import { TestBed, inject, async } from '@angular/core/testing';
import { Http, HttpModule, BaseRequestOptions, Response, ResponseOptions } from '@angular/http';
import { MockBackend } from '@angular/http/testing';
import { BlocksProvider } from './blocks';
import { ApiProvider } from '../api/api';

describe('Blocks Provider', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
      ],
      providers: [
        BlocksProvider,
        ApiProvider,
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

      imports: [
        HttpModule
      ]

    });
  }));

  it('should get blocks', inject([BlocksProvider, MockBackend], (blocksProvider, mockBackend) => {
    const mockResponse: string = `{"blocks":[
      {"height":1563,"size":228,"virtualSize":228,"hash":"489e6480e453d763f58535d0ee01caf12aaaa14950af795b497b227fdbfbc502","time":1522354162,"txlength":1,"poolInfo":{}},
      {"height":1562,"size":228,"virtualSize":228,"hash":"48d7d1881936792f70ace3cdd1a7c4c1fd23271012f91158e3dcd5e41bcbcc8b","time":1522354162,"txlength":1,"poolInfo":{}},
      {"height":1561,"size":228,"virtualSize":228,"hash":"56cce3c458da02bc0c69797362178a5329a634a349c4ac7a15a0569169143de9","time":1522354162,"txlength":1,"poolInfo":{}},
      {"height":1560,"size":228,"virtualSize":228,"hash":"361c6eeadbd4547f8c821befda1d6e5cfcb82cb86069a01c473b53585d58fc34","time":1522354054,"txlength":1,"poolInfo":{}},
      {"height":1559,"size":228,"virtualSize":228,"hash":"435fa05d887f2426e1be3737bf6ef97949431e5bf52f2034fd797068cebedff4","time":1522354054,"txlength":1,"poolInfo":{}},
      {"height":1558,"size":228,"virtualSize":228,"hash":"32b34e269de0d96de19274c05cddf4a4b02abd2415935de5857c109a73b4bdd9","time":1522354054,"txlength":1,"poolInfo":{}},
      {"height":1557,"size":228,"virtualSize":228,"hash":"658314048fe1882392748acc5bb99ad9ab0d34508552a13ad8cbd45bfd8b3350","time":1522354054,"txlength":1,"poolInfo":{}}
      ],"length":7,"pagination":{"next":"2018-03-30","prev":"2018-03-28","currentTs":1522367999,"current":"2018-03-29","isToday":true,"more":false}}`;

    mockBackend.connections.subscribe((connection) => {
      connection.mockRespond(new Response(new ResponseOptions({
        body: mockResponse
      })));
    });

    blocksProvider.getBlocks().subscribe((response) => {
      let blocks: any = JSON.parse(response._body).blocks;

      expect(Array.isArray(blocks)).toBeTruthy();
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.length).toBe(7);
    });
  }));
});
