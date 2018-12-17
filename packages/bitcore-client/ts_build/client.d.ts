import requestStream from 'request';
export declare class Client {
    baseUrl: string;
    authKey: any;
    constructor(params: any);
    sign(params: any): string;
    register(params: any): Promise<any>;
    getBalance(params: any): Promise<any>;
    getAddressTxos: (params: any) => Promise<any>;
    getCoins(params: any): requestStream.Request;
    listTransactions(params: any): requestStream.Request;
    getFee(params: any): Promise<any>;
    importAddresses(params: any): Promise<{}>;
    broadcast(params: any): Promise<any>;
}
