import * as express from 'express';
import request from 'request';
import { Config } from '../../services/config';

export function Web3Proxy(req: express.Request, res: express.Response) {
  const { chain, network } = req.params;
  const chainConfig = Config.chainConfig({ chain, network });
  if (chainConfig && chainConfig.rpc) {
    const { host, port } = chainConfig.rpc;
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
      requestStream = req.pipe(request(url));
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
