import * as express from 'express';
import request from 'request';
import { Config } from '../../services/config';
import { IEVMNetworkConfig } from '../../types/Config';
import { AliasDataRequest } from '../middleware';

export function Web3Proxy(req: express.Request, res: express.Response) {
  let { chain, network } = req as AliasDataRequest;
  const chainConfig: IEVMNetworkConfig = Config.chainConfig({ chain: chain as string, network: network as string });
  const provider = chainConfig.provider || (chainConfig.providers && chainConfig.providers![0]);
  if (provider && chainConfig.publicWeb3) {
    const { host, port } = provider;
    const url = `http://${host}:${port}`;
    let requestStream;
    if (req.body.jsonrpc) {
      const options = {
        uri: url,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        method: req.method,
        body: JSON.stringify(req.body),
        json: true
      };
      requestStream = request(options);
    } else {
      requestStream = req.pipe(request(url) as any);
    }
    requestStream
      .on('error', () => {
        res.status(500).send('An Error Has Occurred');
      })
      .pipe(res);
  } else {
    res.status(500).send(`This node is not configured with a web3 connection for ${chain} ${network} `);
  }
}
