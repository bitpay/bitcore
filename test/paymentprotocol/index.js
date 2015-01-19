'use strict';

var chai = chai || require('chai');
var should = chai.should();
var expect = chai.expect;
var bitcore = bitcore || require('../bitcore');

var is_browser = typeof process == 'undefined'
  || typeof process.versions === 'undefined';

var PayPro = bitcore.PayPro;
var Key = bitcore.Key;

var x509 = {
  priv: ''
    + 'LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFcEFJQkFBS0NBUUVBeFRKdUsyYUdM'
    + 'bjFkWEpLRGg0TXdQTFVrbDNISTVwR25HNWFjNGwvMGlobXE4Y3dDCitGVlBnWk1TNTlheWtpc0Ir'
    + 'ekM3dnR2a0prL2J2K0JTT1g3b3hkSXN1TDNkS1FGcHVYWFZmcmRiOTV3WW40TSsKL25qRWhYTWxo'
    + 'Vk1IL09DaUFnOUpLaFRLV0w2R1JXWkFBaEE3bEJSaGdTTkRUaVRDNTFDYmlLN3hBNnBONCt0UQpI'
    + 'eG9tSlBYclpSa2JCMmtsT2ZXd2J2OTNZM0oxS0ZEK2kwUE1RSEx3N3JoRXVteEM5MytISFVWWVZI'
    + 'N0gxVFBaCkgxYmRVSkowMmdRZXlsSnNzWUNKeWRaUHpOVC96dXRzL0tKV2RSdjVseHdHOXU5dE1O'
    + 'TWdoSmJtQWFNa01HaSsKbzdQTkV5UDNxSEZyWXBZaHM1cHFMSE1STkI3OFFNOUllTmpMRndJREFR'
    + 'QUJBb0lCQVFERVJyalBiQUdjbmwxaAorZGIrOTczNGZ0aElBUkpWSko1dTRFK1JKcThSRWhGTEVL'
    + 'UFlKNW0yUC94dVZBMXpYV2xnYXhaRUZ6d1VRaUpZCjdsOEpLVjlwSHhReVlaQ1M4dndYZzhpWGtz'
    + 'dndQaWRvQmN1YW4vd0RWQ1FCZXk2VkxjVXpSYUd1Ui9sTHNYK1YKN2Z0QjBvUnFsSXFrYmNQZE1N'
    + 'dnFUeG93UnVoUG11Q3JWVGpPNHBiTnFuU09OUExPaUovRkFYYjJwZnpGZnBCUgpHeCtFTW16d2Ur'
    + 'SEZuSkJHRGhIWjk5bm4vVEJmYUp6TlZDcURZLzNid3o1WDdIUU5ZN1QrSnlUVUZzZVE5NHhzCnpy'
    + 'a2lidGRmVGNUanB1K1VoWm80c1p6Q3IrZkhHWm9FOUdEUHF0ZDRnQ3ByazRFS0pzbXFCRVN4QlhT'
    + 'RGhZZ04KOXBVRDM4c1pBb0dCQU9yZkRqdDZaL0ZDamFuVThXek5GaWYrOVQxQTJ4b013RDVWU2xN'
    + 'dVJyWW1HbGZyMEM5TQpmMUVvZ2l2dVRrYnA3cmtnZFRhWVRTYndmTnFaQkt4Y3R5YzdCaGRwWnhE'
    + 'RVdKa2Z5cThxVngvem1Cek1JK1ZzCjJLYi9hcHZXcmJlb3NET0NyeUg1YzhKc1VUOXhUWDNYYnhF'
    + 'anlPSlFCU1lHRE1qUHlKNkU5czZMQW9HQkFOYnYKd2d0S2Nra0tLbDJhNXZzaGR2RENnNnFLL1Fn'
    + 'T20vNktUSlVKRVNqaHoydFIrZlBWUjcwVEg5UmhoVFJscERXQgpCd3oyU2NCc1RRNDIvTGsxRnky'
    + 'MFQvck12S3VmSEw1VE1BNGZ6NWRxMUxIbmN6ejZVazVnWEtBT09rUjlVdVhpClR0eTNoREcyQkM4'
    + 'Nk1LTVJ4SjUxRWJxam94d0VSMTAwU2FuTVBmTWxBb0dBSUhLY1pyOHNhUHBHMC9XbFBPREEKZE5v'
    + 'V1MxWVFidkxnQkR5SVBpR2doejJRV2lFcjY3em53ZkNVdXpqNiszVUtFKzFXQkNyYVRjemZrdHVj'
    + 'OTZyLwphcDRPNDJFZWFnU1dNT0ZoZ1AyYWQ4R1JmRGovcEl4N0NlY3pkVUFkVThnc1A1R0lYR3M0'
    + 'QU40eUEwL0Y0dUxHCloxbklRT3ZKS2syZnFvWjZNdHd2dEswQ2dZRUFnSjdGTGVDRTkzUmYyZGdD'
    + 'ZFRHWGJZZlpKc3M1bEFLNkV0NUwKNmJ1ZFN5dWw1Z0VPWkgyekNsQlJjZFJSMUFNbSt1V1ZoSW8x'
    + 'cERLckFlQ2g1MnIvemRmakxLQXNIejkrQWQ3aQpHUEdzVmw0Vm5jaDFTMzQ0bHJKUGUzQklLZ2dj'
    + 'L1hncDNTYnNzcHJMY2orT0wyZElrOUpXbzZ1Y3hmMUJmMkwwCjJlbGhBUWtDZ1lCWHN5elZWL1pK'
    + 'cVhOcFdDZzU1TDNVRm9UTHlLU3FsVktNM1dpRzVCS240QWF6VkNITCtHUVUKeHd4U2dSOWZRNElu'
    + 'dStyUHJOM0lteWswbEtQR0Y5U3pDUlJUaUpGUjcyc05xbE82bDBWOENXUkFQVFBKY2dxVgoxVThO'
    + 'SEs4YjNaaUlvR0orbXNOenBkeHJqNjJIM0E2K1krQXNOWTRTbVVUWEg5eWpnK251a2c9PQotLS0t'
    + 'LUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo=',
  pub: ''
    + 'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FR'
    + 'OEFNSUlCQ2dLQ0FRRUF4VEp1SzJhR0xuMWRYSktEaDRNdwpQTFVrbDNISTVwR25HNWFjNGwvMGlo'
    + 'bXE4Y3dDK0ZWUGdaTVM1OWF5a2lzQit6Qzd2dHZrSmsvYnYrQlNPWDdvCnhkSXN1TDNkS1FGcHVY'
    + 'WFZmcmRiOTV3WW40TSsvbmpFaFhNbGhWTUgvT0NpQWc5SktoVEtXTDZHUldaQUFoQTcKbEJSaGdT'
    + 'TkRUaVRDNTFDYmlLN3hBNnBONCt0UUh4b21KUFhyWlJrYkIya2xPZld3YnY5M1kzSjFLRkQraTBQ'
    + 'TQpRSEx3N3JoRXVteEM5MytISFVWWVZIN0gxVFBaSDFiZFVKSjAyZ1FleWxKc3NZQ0p5ZFpQek5U'
    + 'L3p1dHMvS0pXCmRSdjVseHdHOXU5dE1OTWdoSmJtQWFNa01HaStvN1BORXlQM3FIRnJZcFloczVw'
    + 'cUxITVJOQjc4UU05SWVOakwKRndJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg==',
  der: ''
    + 'MIIDBjCCAe4CCQDI2qWdA3/VpDANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJBVTETMBEGA1UE'
    + 'CAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMB4XDTE0MDcx'
    + 'NjAxMzM1MVoXDTE1MDcxNjAxMzM1MVowRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3Rh'
    + 'dGUxITAfBgNVBAoMGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQAD'
    + 'ggEPADCCAQoCggEBAMUybitmhi59XVySg4eDMDy1JJdxyOaRpxuWnOJf9IoZqvHMAvhVT4GTEufW'
    + 'spIrAfswu77b5CZP27/gUjl+6MXSLLi93SkBabl11X63W/ecGJ+DPv54xIVzJYVTB/zgogIPSSoU'
    + 'yli+hkVmQAIQO5QUYYEjQ04kwudQm4iu8QOqTePrUB8aJiT162UZGwdpJTn1sG7/d2NydShQ/otD'
    + 'zEBy8O64RLpsQvd/hx1FWFR+x9Uz2R9W3VCSdNoEHspSbLGAicnWT8zU/87rbPyiVnUb+ZccBvbv'
    + 'bTDTIISW5gGjJDBovqOzzRMj96hxa2KWIbOaaixzETQe/EDPSHjYyxcCAwEAATANBgkqhkiG9w0B'
    + 'AQUFAAOCAQEAL6AMMfC3TlRcmsIgHxjVD4XYtISlldnrn2X9zvFbJKCpNy8XQQosQxrhyfzPHQKj'
    + 'lS2L/KCGMnjx9QkYD2Hlp1MJ1uVv9888th/gcZOv3Or3hQyi5K1Sh5xCG+69lUOqUEGu9B4irsqo'
    + 'FomQVbQolSy+t4apdJi7kuEDwFDk4gZiVEfsuX+naN5a6pCnWnhX1Vf4fKwfkLobKKXm2zQVsjxl'
    + 'wBAqOEmJGDLoRMXH56qJnEZ/dqsczaJOHQSi9mFEHL0r5rsEDTT5AVxdnBfNnyGaCH7/zANEko+F'
    + 'GBj1JdJaJgFTXdbxDoyoPTPD+LJqSK5XYToo46y/T0u9CLveNA==',
  pem: ''
    + 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURCakNDQWU0Q0NRREkycVdkQTMvVnBEQU5C'
    + 'Z2txaGtpRzl3MEJBUVVGQURCRk1Rc3dDUVlEVlFRR0V3SkIKVlRFVE1CRUdBMVVFQ0F3S1UyOXRa'
    + 'UzFUZEdGMFpURWhNQjhHQTFVRUNnd1lTVzUwWlhKdVpYUWdWMmxrWjJsMApjeUJRZEhrZ1RIUmtN'
    + 'QjRYRFRFME1EY3hOakF4TXpNMU1Wb1hEVEUxTURjeE5qQXhNek0xTVZvd1JURUxNQWtHCkExVUVC'
    + 'aE1DUVZVeEV6QVJCZ05WQkFnTUNsTnZiV1V0VTNSaGRHVXhJVEFmQmdOVkJBb01HRWx1ZEdWeWJt'
    + 'VjAKSUZkcFpHZHBkSE1nVUhSNUlFeDBaRENDQVNJd0RRWUpLb1pJaHZjTkFRRUJCUUFEZ2dFUEFE'
    + 'Q0NBUW9DZ2dFQgpBTVV5Yml0bWhpNTlYVnlTZzRlRE1EeTFKSmR4eU9hUnB4dVduT0pmOUlvWnF2'
    + 'SE1BdmhWVDRHVEV1ZldzcElyCkFmc3d1NzdiNUNaUDI3L2dVamwrNk1YU0xMaTkzU2tCYWJsMTFY'
    + 'NjNXL2VjR0orRFB2NTR4SVZ6SllWVEIvemcKb2dJUFNTb1V5bGkraGtWbVFBSVFPNVFVWVlFalEw'
    + 'NGt3dWRRbTRpdThRT3FUZVByVUI4YUppVDE2MlVaR3dkcApKVG4xc0c3L2QyTnlkU2hRL290RHpF'
    + 'Qnk4TzY0Ukxwc1F2ZC9oeDFGV0ZSK3g5VXoyUjlXM1ZDU2ROb0VIc3BTCmJMR0FpY25XVDh6VS84'
    + 'N3JiUHlpVm5VYitaY2NCdmJ2YlREVElJU1c1Z0dqSkRCb3ZxT3p6Uk1qOTZoeGEyS1cKSWJPYWFp'
    + 'eHpFVFFlL0VEUFNIall5eGNDQXdFQUFUQU5CZ2txaGtpRzl3MEJBUVVGQUFPQ0FRRUFMNkFNTWZD'
    + 'MwpUbFJjbXNJZ0h4alZENFhZdElTbGxkbnJuMlg5enZGYkpLQ3BOeThYUVFvc1F4cmh5ZnpQSFFL'
    + 'amxTMkwvS0NHCk1uang5UWtZRDJIbHAxTUoxdVZ2OTg4OHRoL2djWk92M09yM2hReWk1SzFTaDV4'
    + 'Q0crNjlsVU9xVUVHdTlCNGkKcnNxb0ZvbVFWYlFvbFN5K3Q0YXBkSmk3a3VFRHdGRGs0Z1ppVkVm'
    + 'c3VYK25hTjVhNnBDblduaFgxVmY0Zkt3ZgprTG9iS0tYbTJ6UVZzanhsd0JBcU9FbUpHRExvUk1Y'
    + 'SDU2cUpuRVovZHFzY3phSk9IUVNpOW1GRUhMMHI1cnNFCkRUVDVBVnhkbkJmTm55R2FDSDcvekFO'
    + 'RWtvK0ZHQmoxSmRKYUpnRlRYZGJ4RG95b1BUUEQrTEpxU0s1WFlUb28KNDZ5L1QwdTlDTHZlTkE9'
    + 'PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==',
  sig1: new Buffer(0),
  sig2: new Buffer(0),
  sig3: new Buffer(0)
};

x509.priv = new Buffer(x509.priv, 'base64');
x509.pub = new Buffer(x509.pub, 'base64');
x509.der = new Buffer(x509.der, 'base64');
x509.pem = new Buffer(x509.pem, 'base64');

// A test PaymentRequest (with a full cert chain) from test.bitpay.com:

var bitpayRequest = new Buffer(''
  + '0801120b783530392b7368613235361a89250aa40a3082052030820408a0'
  + '03020102020727a49d05046d62300d06092a864886f70d01010b05003081'
  + 'b4310b30090603550406130255533110300e060355040813074172697a6f'
  + '6e61311330110603550407130a53636f74747364616c65311a3018060355'
  + '040a1311476f44616464792e636f6d2c20496e632e312d302b060355040b'
  + '1324687474703a2f2f63657274732e676f64616464792e636f6d2f726570'
  + '6f7369746f72792f313330310603550403132a476f204461646479205365'
  + '6375726520436572746966696361746520417574686f72697479202d2047'
  + '32301e170d3134303432363132333532365a170d31363034323631323335'
  + '32365a303a3121301f060355040b1318446f6d61696e20436f6e74726f6c'
  + '2056616c6964617465643115301306035504030c0c2a2e6269747061792e'
  + '636f6d30820122300d06092a864886f70d01010105000382010f00308201'
  + '0a0282010100e2a5dd4aea959c1d0fb016e6e05bb7011e741cdc61918c61'
  + 'f9625a2f682f485f0e862ea63db61cc9161753127504de800604df36b10f'
  + '46cb17ab6cb99dba8aa45a36adfb901a2fc380c89e234bce18de6639b883'
  + 'e9339801673efaee1f2df77eeb82f7c39c96a2f8ef4572b634c203d9be8f'
  + 'd1e0036d32fb38b6b9b5ecd5a0684345c7e9ffc5d26bc6fd69aa6619f77b'
  + 'adaa4bfb989478fb2f41aa92782e40b34ba9ac4549a4e6fda76b5fc4a581'
  + '853bd0de5fb5a2c6dfdc12cdfadb54e9636a6d1223705924b8be566b81ac'
  + '7921078cf590a146ae397a84908ef4fc83ff5715a44ab59e9258674d9011'
  + '3bb607b8d81eb268e4c6ce849497c76521795b0873950203010001a38201'
  + 'ae308201aa300f0603551d130101ff04053003010100301d0603551d2504'
  + '16301406082b0601050507030106082b06010505070302300e0603551d0f'
  + '0101ff0404030205a030360603551d1f042f302d302ba029a02786256874'
  + '74703a2f2f63726c2e676f64616464792e636f6d2f676469673273312d34'
  + '392e63726c30530603551d20044c304a3048060b6086480186fd6d010717'
  + '013039303706082b06010505070201162b687474703a2f2f636572746966'
  + '6963617465732e676f64616464792e636f6d2f7265706f7369746f72792f'
  + '307606082b06010505070101046a3068302406082b060105050730018618'
  + '687474703a2f2f6f6373702e676f64616464792e636f6d2f304006082b06'
  + '0105050730028634687474703a2f2f6365727469666963617465732e676f'
  + '64616464792e636f6d2f7265706f7369746f72792f67646967322e637274'
  + '301f0603551d2304183016801440c2bd278ecc348330a233d7fb6cb3f0b4'
  + '2c80ce30230603551d11041c301a820c2a2e6269747061792e636f6d820a'
  + '6269747061792e636f6d301d0603551d0e0416041485454e3b4072e2f58e'
  + '377438988b5229387e967a300d06092a864886f70d01010b050003820101'
  + '002d0a7ef97f988905ebbbad4e9ffb690352535211d6792516119838b55f'
  + '24ff9fa4e93b6187b8517cbb0477457d3378078ef66057abe41bcafeb142'
  + 'ec52443a94b88114fa069f725c6198581d97af16352727f4f35e7f2110fa'
  + 'a41a0511bcfdf8e3f4a3a310278c150b10f32a962c81e8f3d5374d9cb56d'
  + '893027ff4fa4e3c3e6384c1f1557ceea6fca9cbc0c110748c08b82d8f0ed'
  + '9a579637ee43a2d8fec3b5b04d1f3c8f1a3e2088da2274b6bc60948bbe74'
  + '4a7f8b942b41f0ae9b4afaeefbb7e0f04a0587b52efb6ebfa2d970b9de56'
  + 'a068575e4bf0cf824618dc17bbeaa2cdd25d65970a9f1a06fc9fffb466a1'
  + '0c9568cd651795bc2c7996975027bdbaba0ad409308204d0308203b8a003'
  + '020102020107300d06092a864886f70d01010b0500308183310b30090603'
  + '550406130255533110300e060355040813074172697a6f6e613113301106'
  + '03550407130a53636f74747364616c65311a3018060355040a1311476f44'
  + '616464792e636f6d2c20496e632e3131302f06035504031328476f204461'
  + '64647920526f6f7420436572746966696361746520417574686f72697479'
  + '202d204732301e170d3131303530333037303030305a170d333130353033'
  + '3037303030305a3081b4310b30090603550406130255533110300e060355'
  + '040813074172697a6f6e61311330110603550407130a53636f7474736461'
  + '6c65311a3018060355040a1311476f44616464792e636f6d2c20496e632e'
  + '312d302b060355040b1324687474703a2f2f63657274732e676f64616464'
  + '792e636f6d2f7265706f7369746f72792f313330310603550403132a476f'
  + '204461646479205365637572652043657274696669636174652041757468'
  + '6f72697479202d20473230820122300d06092a864886f70d010101050003'
  + '82010f003082010a0282010100b9e0cb10d4af76bdd49362eb3064b88108'
  + '6cc304d962178e2fff3e65cf8fce62e63c521cda16454b55ab786b638362'
  + '90ce0f696c99c81a148b4ccc4533ea88dc9ea3af2bfe80619d7957c4cf2e'
  + 'f43f303c5d47fc9a16bcc3379641518e114b54f828bed08cbef030381ef3'
  + 'b026f86647636dde7126478f384753d1461db4e3dc00ea45acbdbc71d9aa'
  + '6f00dbdbcd303a794f5f4c47f81def5bc2c49d603bb1b24391d8a4334eea'
  + 'b3d6274fad258aa5c6f4d5d0a6ae7405645788b54455d42d2a3a3ef8b8bd'
  + 'e9320a029464c4163a50f14aaee77933af0c20077fe8df0439c269026c63'
  + '52fa77c11bc87487c8b993185054354b694ebc3bd3492e1fdcc1d252fb02'
  + '03010001a382011a30820116300f0603551d130101ff040530030101ff30'
  + '0e0603551d0f0101ff040403020106301d0603551d0e0416041440c2bd27'
  + '8ecc348330a233d7fb6cb3f0b42c80ce301f0603551d230418301680143a'
  + '9a8507106728b6eff6bd05416e20c194da0fde303406082b060105050701'
  + '0104283026302406082b060105050730018618687474703a2f2f6f637370'
  + '2e676f64616464792e636f6d2f30350603551d1f042e302c302aa028a026'
  + '8624687474703a2f2f63726c2e676f64616464792e636f6d2f6764726f6f'
  + '742d67322e63726c30460603551d20043f303d303b0604551d2000303330'
  + '3106082b06010505070201162568747470733a2f2f63657274732e676f64'
  + '616464792e636f6d2f7265706f7369746f72792f300d06092a864886f70d'
  + '01010b05000382010100087e6c9310c838b896a9904bffa15f4f04ef6c3e'
  + '9c8806c9508fa673f757311bbebce42fdbf8bad35be0b4e7e679620e0ca2'
  + 'd76a637331b5f5a848a43b082da25d90d7b47c254f115630c4b6449d7b2c'
  + '9de55ee6ef0c61aabfe42a1bee849eb8837dc143ce44a713700d911ff4c8'
  + '13ad8360d9d872a873241eb5ac220eca17896258441bab892501000fcdc4'
  + '1b62db51b4d30f512a9bf4bc73fc76ce36a4cdd9d82ceaae9bf52ab290d1'
  + '4d75188a3f8a4190237d5b4bfea403589b46b2c3606083f87d5041cec2a1'
  + '90c3bbef022fd21554ee4415d90aaea78a33edb12d763626dc04eb9ff761'
  + '1f15dc876fee469628ada1267d0a09a72e04a38dbcf8bc0430010a810930'
  + '82047d30820365a00302010202031be715300d06092a864886f70d01010b'
  + '05003063310b30090603550406130255533121301f060355040a13185468'
  + '6520476f2044616464792047726f75702c20496e632e3131302f06035504'
  + '0b1328476f20446164647920436c61737320322043657274696669636174'
  + '696f6e20417574686f72697479301e170d3134303130313037303030305a'
  + '170d3331303533303037303030305a308183310b30090603550406130255'
  + '533110300e060355040813074172697a6f6e61311330110603550407130a'
  + '53636f74747364616c65311a3018060355040a1311476f44616464792e63'
  + '6f6d2c20496e632e3131302f06035504031328476f20446164647920526f'
  + '6f7420436572746966696361746520417574686f72697479202d20473230'
  + '820122300d06092a864886f70d01010105000382010f003082010a028201'
  + '0100bf716208f1fa5934f71bc918a3f7804958e9228313a6c52043013b84'
  + 'f1e685499f27eaf6841b4ea0b4db7098c73201b1053e074eeef4fa4f2f59'
  + '3022e7ab19566be28007fcf316758039517be5f935b6744ea98d8213e4b6'
  + '3fa90383faa2be8a156a7fde0bc3b6191405caeac3a804943b467c320df3'
  + '006622c88d696d368c1118b7d3b21c60b438fa028cced3dd4607de0a3eeb'
  + '5d7cc87cfbb02b53a4926269512505611a44818c2ca9439623dfac3a819a'
  + '0e29c51ca9e95d1eb69e9e300a39cef18880fb4b5dcc32ec856243253402'
  + '56270191b43b702a3f6eb1e89c88017d9fd4f9db536d609dbf2ce758abb8'
  + '5f46fccec41b033c09eb49315c6946b3e0470203010001a3820117308201'
  + '13300f0603551d130101ff040530030101ff300e0603551d0f0101ff0404'
  + '03020106301d0603551d0e041604143a9a8507106728b6eff6bd05416e20'
  + 'c194da0fde301f0603551d23041830168014d2c4b0d291d44c1171b361cb'
  + '3da1fedda86ad4e3303406082b0601050507010104283026302406082b06'
  + '0105050730018618687474703a2f2f6f6373702e676f64616464792e636f'
  + '6d2f30320603551d1f042b30293027a025a0238621687474703a2f2f6372'
  + '6c2e676f64616464792e636f6d2f6764726f6f742e63726c30460603551d'
  + '20043f303d303b0604551d20003033303106082b06010505070201162568'
  + '747470733a2f2f63657274732e676f64616464792e636f6d2f7265706f73'
  + '69746f72792f300d06092a864886f70d01010b05000382010100590b53bd'
  + '928611a7247bed5b31cf1d1f6c70c5b86ebe4ebbf6be9750e1307fba285c'
  + '6294c2e37e33f7fb427685db951c8c225875090c886567390a1609c5a038'
  + '97a4c523933fb418a601064491e3a76927b45a257f3ab732cddd84ff2a38'
  + '2933a4dd67b285fea188201c5089c8dc2af64203374ce688dfd5af24f2b1'
  + 'c3dfccb5ece0995eb74954203c94180cc71c521849a46de1b3580bc9d8ec'
  + 'd9ae1c328e28700de2fea6179e840fbd5770b35ae91fa08653bbef7cff69'
  + '0be048c3b7930bc80a54c4ac5d1467376ccaa52f310837aa6e6f8cbc9be2'
  + '575d2481af97979c84ad6cac374c66f361911120e4be309f7aa42909b0e1'
  + '345f6477184051df8c30a6af0a840830820400308202e8a0030201020201'
  + '00300d06092a864886f70d01010505003063310b30090603550406130255'
  + '533121301f060355040a131854686520476f2044616464792047726f7570'
  + '2c20496e632e3131302f060355040b1328476f20446164647920436c6173'
  + '7320322043657274696669636174696f6e20417574686f72697479301e17'
  + '0d3034303632393137303632305a170d3334303632393137303632305a30'
  + '63310b30090603550406130255533121301f060355040a13185468652047'
  + '6f2044616464792047726f75702c20496e632e3131302f060355040b1328'
  + '476f20446164647920436c61737320322043657274696669636174696f6e'
  + '20417574686f7269747930820120300d06092a864886f70d010101050003'
  + '82010d00308201080282010100de9dd7ea571849a15bebd75f4886eabedd'
  + 'ffe4ef671cf46568b35771a05e77bbed9b49e970803d561863086fdaf2cc'
  + 'd03f7f0254225410d8b281d4c0753d4b7fc777c33e78ab1a03b5206b2f6a'
  + '2bb1c5887ec4bb1eb0c1d845276faa3758f78726d7d82df6a917b71f7236'
  + '4ea6173f659892db2a6e5da2fe88e00bde7fe58d15e1ebcb3ad5e212a213'
  + '2dd88eaf5f123da0080508b65ca565380445991ea3606074c541a572621b'
  + '62c51f6f5f1a42be025165a8ae23186afc7803a94d7f80c3faab5afca140'
  + 'a4ca1916feb2c8ef5e730dee77bd9af67998bcb10767a2150ddda058c644'
  + '7b0a3e62285fba41075358cf117e3874c5f8ffb569908f8474ea971baf02'
  + '0103a381c03081bd301d0603551d0e04160414d2c4b0d291d44c1171b361'
  + 'cb3da1fedda86ad4e330818d0603551d230481853081828014d2c4b0d291'
  + 'd44c1171b361cb3da1fedda86ad4e3a167a4653063310b30090603550406'
  + '130255533121301f060355040a131854686520476f204461646479204772'
  + '6f75702c20496e632e3131302f060355040b1328476f2044616464792043'
  + '6c61737320322043657274696669636174696f6e20417574686f72697479'
  + '820100300c0603551d13040530030101ff300d06092a864886f70d010105'
  + '05000382010100324bf3b2ca3e91fc12c6a1078c8e77a03306145c901e18'
  + 'f708a63d0a19f98780116e69e4961730ff3491637238eecc1c01a31d9428'
  + 'a431f67ac454d7f6e5315803a2ccce62db944573b5bf45c924b5d58202ad'
  + '2379698db8b64dcecf4cca3323e81c88aa9d8b416e16c920e5899ecd3bda'
  + '70f77e992620145425ab6e7385e69b219d0a6c820ea8f8c20cfa101e6c96'
  + 'ef870dc40f618badee832b95f88e92847239eb20ea83ed83cd976e08bceb'
  + '4e26b6732be4d3f64cfe2671e26111744aff571a870f75482ecf516917a0'
  + '02126195d5d140b2104ceec4ac1043a6a59e0ad595629a0dcf8882c5320c'
  + 'e42b9f45e60d9f289cb1b92a5a57ad370faf1d7fdbbd9f22a1010a047465'
  + '7374122008c0c9e714121976a914176d7c5d60da6f8c82de86671a1fb776'
  + '028538ca88ac18c6f5d89f0520cafcd89f052a395061796d656e74207265'
  + '717565737420666f722042697450617920696e766f69636520434d577075'
  + '46736a676d51325a4c6979476663463157323068747470733a2f2f746573'
  + '742e6269747061792e636f6d2f692f434d57707546736a676d51325a4c69'
  + '794766634631572a80021566366ab78842a514c056ca7ecb76481262cac7'
  + '4cc4c4ccdc82c4980bc3300de67836d61d3e06dc8c90798a7774c21c7ad4'
  + 'fe634b85faa8719d6402411bb720396ae03cbb4e14f06f7894a66b208b99'
  + 'f727fab35d32f4f2148294d24bea1b3f240c159d0fd3ee4a32e5f926bf7c'
  + '05eb7a3f75e01d9af81254cfbb61606467750ea7e0a1536728358e0898d0'
  + '6f57235e4096d2caf647ae58dff645be80c9b3555fa96c81efa07d421977'
  + 'd26214ad4f1ff642a93d0925656aeab454fa0b60fcbb6c1bc570eb6e43e7'
  + '613392f37900748635ae381534bfaa558792bc46028b9efce391423a9c12'
  + '01f76292614b30a14272e837f3813045b035f3d42f4f76f48acd',
  'hex');

describe('PayPro', function() {

  it('should be able to create class', function() {
    should.exist(PayPro);
  });

  describe('#Output', function() {

    it('should not fail', function() {
      var obj = {};
      var output = new PayPro.Output();
      output.$set('amount', 20);
    });

    it('should be able to set the amount of an output', function() {
      var output = new PayPro.Output();
      output.set('amount', 20);
      output.get('amount').toInt().should.equal(20);
    });

  });

  describe('#PaymentDetails', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.PaymentDetails();
    });

    it('should set the memo', function() {
      var obj = {};
      var pd = new PayPro.PaymentDetails();
      pd.set('memo', 'test memo');
      pd.get('memo').should.equal('test memo');
    });

    it('should serialize', function() {
      var obj = {};
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      pd.set('memo', 'test memo');
      var hex = pd.toHex();
      hex.length.should.be.greaterThan(0);
    });

  });

  describe('#PaymentRequest', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.PaymentRequest();
    });

    it('should serialize', function() {
      var obj = {};
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var pr = new PayPro.PaymentRequest();
      pr.set('serialized_payment_details', pdbuf);
      var prhex = pr.toHex();
      prhex.length.should.be.greaterThan(0);
    });

  });

  describe('#Payment', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.Payment();
    });

    it('should serialize', function() {
      var obj = {};
      var p = new PayPro.Payment();
      p.set('memo', 'this is a memo');
      p.get('memo').should.equal('this is a memo');
      var phex = p.toHex();
      phex.length.should.be.greaterThan(0);
    });

  });

  describe('#PaymentACK', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.PaymentACK();
    });

    it('should serialize', function() {
      var obj = {};
      var p = new PayPro.Payment();
      var pa = new PayPro.PaymentACK();
      pa.set('payment', p);
      pa.set('memo', 'this is a memo');
      pa.get('memo').should.equal('this is a memo');
      var pahex = pa.toHex();
      pahex.length.should.be.greaterThan(0);
    });

  });

  describe('#X509Certificates', function() {

    it('should not fail', function() {
      var obj = {};
      var pd = new PayPro.X509Certificates();
    });

    it('should serialize', function() {
      var obj = {};
      var x = new PayPro.X509Certificates();
      var fakecertificate = new Buffer([0, 0, 0, 0]);
      x.set('certificate', [fakecertificate]);
      var xhex = x.toHex();
      xhex.length.should.be.greaterThan(0);
    });

  });

  describe('#isValidSize', function() {

    it('should return true for validly sized payment', function() {
      var paypro = new PayPro();
      paypro.makePayment();
      paypro.set('memo', 'test memo');
      paypro.isValidSize().should.equal(true);
    });

  });

  describe('#getContentType', function() {

    it('should get a content type for payment', function() {
      var paypro = new PayPro();
      paypro.makePayment();
      paypro.set('memo', 'test memo');
      paypro.getContentType().should.equal('application/bitcoin-payment');
    });

  });

  describe('#set', function() {

    it('should set a field', function() {
      var obj = {};
      var paypro = new PayPro();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.get('memo').should.equal('test memo');
    });

  });

  describe('#get', function() {

    it('should get a field', function() {
      var obj = {};
      var paypro = new PayPro();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.get('memo').should.equal('test memo');
    });

  });

  describe('#setObj', function() {

    it('should set properties of paymentdetails', function() {
      var pd = new PayPro.PaymentDetails();
      var paypro = new PayPro();
      paypro.messageType = "PaymentDetails";
      paypro.message = pd;
      paypro.setObj({
        time: 0
      });
      paypro.get('time').should.equal(0);
    });

  });

  describe('#serializeForSig', function() {

    it('should serialize a PaymentRequest and not fail', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      var buf = paypro.serializeForSig();
      buf.length.should.be.greaterThan(0);
    });

  });

  describe('#serialize', function() {

    it('should serialize', function() {
      var obj = {};
      var paypro = new PayPro();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.set('time', 0);
      var buf = paypro.serialize();
      buf.length.should.be.greaterThan(0);
      Buffer.isBuffer(buf).should.equal(true);
    });

  });

  describe('#deserialize', function() {

    it('should deserialize a serialized message', function() {
      var obj = {};
      var paypro = new PayPro();
      paypro.makePaymentDetails();
      paypro.set('memo', 'test memo');
      paypro.set('time', 0);
      var buf = paypro.serialize();
      var paypro2 = new PayPro();
      paypro2.deserialize(buf, 'PaymentDetails');
      paypro2.get('memo').should.equal('test memo');
      paypro2.get('time').should.equal(0);
    });

  });

  describe('#sign', function() {

    it('should sign a payment request', function() {
      // SIN
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test key');
      key.regenerateSync();
      paypro.sign(key);
      var sig = paypro.get('signature');
      sig.length.should.be.greaterThan(0);

      // X509
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      paypro.sign(x509.priv);
      x509.sig1 = paypro.get('signature');
      x509.sig1.length.should.be.greaterThan(0);
    });

  });

  describe('#verify', function() {

    it('should verify a signed payment request', function() {
      // SIN
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test key');
      key.regenerateSync();
      paypro.sign(key);
      var verify = paypro.verify();
      verify.should.equal(true);

      // X509
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');
      paypro.set('signature', x509.sig1); // sig buffer

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var verify = paypro.verify();
      verify.should.equal(true);

      var trust = paypro.verify(true);
      trust.selfSigned.should.equal(1);
      trust.isChain.should.equal(false);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(false);
      should.equal(null, trust.caName);
      trust.chainVerified.should.equal(false);
    });

  });

  describe('#sinSign', function() {

    it('should sign assuming pki_type is SIN', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test key');
      key.regenerateSync();
      var sig = paypro.sinSign(key);
      sig.length.should.be.greaterThan(0);
    });

  });

  describe('#sinVerify', function() {

    it('should verify assuming pki_type is SIN', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);
      var pdbuf = pd.toBuffer();
      var paypro = new PayPro();
      paypro.makePaymentRequest();
      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'SIN');
      var key = new bitcore.Key();
      key.private = bitcore.util.sha256('test key');
      key.regenerateSync();
      paypro.sign(key);
      var verify = paypro.sinVerify();
      verify.should.equal(true);
    });

  });

  describe('#x509+sha256Sign', function() {
    it('should sign assuming pki_type is x509+sha256', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var sig = paypro.x509Sign(x509.priv);
      paypro.set('signature', sig);

      x509.sig2 = paypro.get('signature');
      x509.sig2.length.should.be.greaterThan(0);
    });
  });

  describe('#x509+sha256Verify', function() {
    it('should verify assuming pki_type is x509+sha256', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha256');

      paypro.set('signature', x509.sig2); // sig buffer

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var verify = paypro.x509Verify();
      verify.should.equal(true);

      var trust = paypro.x509Verify(true);
      trust.selfSigned.should.equal(1);
      trust.isChain.should.equal(false);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(false);
      should.equal(null, trust.caName);
      trust.chainVerified.should.equal(false);
    });
  });

  describe('#x509+sha1Sign', function() {
    it('should sign assuming pki_type is x509+sha1', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha1');

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var sig = paypro.x509Sign(x509.priv);
      paypro.set('signature', sig);

      x509.sig3 = paypro.get('signature');
      x509.sig3.length.should.be.greaterThan(0);
    });
  });

  describe('#x509+sha1Verify', function() {
    it('should verify assuming pki_type is x509+sha1', function() {
      var pd = new PayPro.PaymentDetails();
      pd.set('time', 0);

      var pdbuf = pd.toBuffer();

      var paypro = new PayPro();
      paypro.makePaymentRequest();

      paypro.set('serialized_payment_details', pdbuf);
      paypro.set('pki_type', 'x509+sha1');

      paypro.set('signature', x509.sig3); // sig buffer

      var cr = new PayPro();
      cr = cr.makeX509Certificates();
      cr.set('certificate', [x509.der]);

      paypro.set('pki_data', cr.serialize()); // contains one or more x509 certs

      var verify = paypro.x509Verify();
      verify.should.equal(true);

      var trust = paypro.x509Verify(true);
      trust.selfSigned.should.equal(1);
      trust.isChain.should.equal(false);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(false);
      should.equal(null, trust.caName);
      trust.chainVerified.should.equal(false);
    });
  });

  describe('#x509+sha256Verify ', function() {
    it('should verify a real PaymentRequest', function() {
      var data = PayPro.PaymentRequest.decode(bitpayRequest);
      var pr = new PayPro();
      pr = pr.makePaymentRequest(data);

      // PaymentRequest
      var ver = pr.get('payment_details_version');
      var pki_type = pr.get('pki_type');
      var pki_data = pr.get('pki_data');
      var details = pr.get('serialized_payment_details');
      var sig = pr.get('signature');

      pki_data = PayPro.X509Certificates.decode(pki_data);
      pki_data = pki_data.certificate;

      ver.should.equal(1);
      pki_type.should.equal('x509+sha256');
      pki_data.length.should.equal(4);
      sig.toString('hex').should.equal(''
        + '1566366ab78842a514c056ca7ecb76481262cac74cc4c4ccdc'
        + '82c4980bc3300de67836d61d3e06dc8c90798a7774c21c7ad4'
        + 'fe634b85faa8719d6402411bb720396ae03cbb4e14f06f7894'
        + 'a66b208b99f727fab35d32f4f2148294d24bea1b3f240c159d'
        + '0fd3ee4a32e5f926bf7c05eb7a3f75e01d9af81254cfbb6160'
        + '6467750ea7e0a1536728358e0898d06f57235e4096d2caf647'
        + 'ae58dff645be80c9b3555fa96c81efa07d421977d26214ad4f'
        + '1ff642a93d0925656aeab454fa0b60fcbb6c1bc570eb6e43e7'
        + '613392f37900748635ae381534bfaa558792bc46028b9efce3'
        + '91423a9c1201f76292614b30a14272e837f3813045b035f3d4'
        + '2f4f76f48acd');

      if (is_browser) {
        var type = 'SHA256';
        var pem = PayPro.prototype._DERtoPEM(pki_data[0], 'CERTIFICATE');
        var buf = pr.serializeForSig();
        var jsrsaSig = new KJUR.crypto.Signature({
          alg: type + 'withRSA',
          prov: 'cryptojs/jsrsa'
        });
        var signedCert = pki_data[0];
        var der = signedCert.toString('hex');
        // var pem = PayPro.DERtoPEM(der, 'CERTIFICATE');
        var pem = KJUR.asn1.ASN1Util.getPEMStringFromHex(der, 'CERTIFICATE');
        jsrsaSig.initVerifyByCertificatePEM(pem);
        jsrsaSig.updateHex(buf.toString('hex'));
        jsrsaSig.verify(sig.toString('hex')).should.equal(true);
      } else {
        var crypto = require('crypto');
        var type = 'SHA256';
        var pem = PayPro.DERtoPEM(pki_data[0], 'CERTIFICATE');
        var buf = pr.serializeForSig();
        var verifier = crypto.createVerify('RSA-' + type);
        verifier.update(buf);
        verifier.verify(pem, sig).should.equal(true);
      }

      // Verify Signature
      var verified = pr.x509Verify();
      verified.should.equal(true);

      // Verify Signature with trust properties
      var trust = pr.x509Verify(true);
      trust.selfSigned.should.equal(0);
      trust.isChain.should.equal(true);
      trust.verified.should.equal(true);
      trust.caTrusted.should.equal(true);
      trust.caName.should.equal('Go Daddy Class 2 CA');
      trust.chainVerified.should.equal(true);

      // PaymentDetails
      details = PayPro.PaymentDetails.decode(details);
      var pd = new PayPro();
      pd = pd.makePaymentDetails(details);
      var network = pd.get('network');
      var outputs = pd.get('outputs');
      var time = pd.get('time');
      var expires = pd.get('expires');
      var memo = pd.get('memo');
      var payment_url = pd.get('payment_url');
      var merchant_data = pd.get('merchant_data');

      network.should.equal('test');
      outputs.length.should.equal(1);
      outputs[0].amount.should.not.equal(undefined);
      outputs[0].script.should.not.equal(undefined);
      time.should.equal(1408645830);
      expires.should.equal(1408646730);
      memo.should.equal('Payment request for BitPay invoice CMWpuFsjgmQ2ZLiyGfcF1W');
      payment_url.should.equal('https://test.bitpay.com/i/CMWpuFsjgmQ2ZLiyGfcF1W');
      should.equal(null, merchant_data);
    });
  });

  describe('#PEMtoDER', function() {
    it('should convert a PEM cert to DER', function() {
      var paypro = new PayPro();
      var der1 = paypro._PEMtoDERParam(x509.pem.toString(), 'CERTIFICATE').map(function(der) {
        return der.toString('hex');
      });
      der1 = der1[0];
      var der2 = x509.der.toString('hex');
      der1.should.equal(der2);
    });
  });

  describe('#DERtoPEM', function() {
    it('convert a DER cert to PEM', function() {
      var paypro = new PayPro();
      var pem1 = paypro._DERtoPEM(x509.der, 'CERTIFICATE');
      //var KJUR = require('jsrsasign');
      //var pem2 = KJUR.asn1.ASN1Util.getPEMStringFromHex(x509.der.toString('hex'), 'CERTIFICATE');
      var pem2 = x509.pem.toString();
      pem1 = pem1.replace(/\s+/g, '');
      pem2 = pem2.replace(/\s+/g, '');
      pem1.should.equal(pem2);
    });
  });

});
