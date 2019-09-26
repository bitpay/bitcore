import { Request, Response } from 'express';
import { ChainStateProvider } from '../../providers/chain-state';
import { SetCache, CacheTimes, Confirmations } from '../middleware';
import { BitcoinBlockStorage } from '../../models/block';
import { TransactionStorage } from '../../models/transaction';
import { CoinStorage } from '../../models/coin';

const router = require('express').Router({ mergeParams: true });

router.get('/', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  let { sinceBlock, date, limit, since, direction, paging } = req.query;
  if (limit) {
    limit = parseInt(limit);
  }
  try {
    let payload = {
      chain,
      network,
      sinceBlock,
      args: { date, limit, since, direction, paging },
      req,
      res
    };
    return ChainStateProvider.streamBlocks(payload);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/tip', async function(req: Request, res: Response) {
  let { chain, network } = req.params;
  try {
    let tip = await ChainStateProvider.getBlock({ chain, network });
    return res.json(tip);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});

router.get('/:blockId', async function(req: Request, res: Response) {
  let { blockId, chain, network } = req.params;
  try {
    let block = await ChainStateProvider.getBlock({ chain, network, blockId });
    if (!block) {
      return res.status(404).send('block not found');
    }
    const tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (block && tip && tip.height - block.height > Confirmations.Deep) {
      SetCache(res, CacheTimes.Month);
    }
    return res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

//return mapping of {txid: {inputs, ouputs}} paginated at 20 per page, to limit reqs and overload
router.get('/:blockHash/coins/:limit/:pgnum', async function (req: Request, res: Response) {
  let { chain, network, blockHash, limit, pgnum } = req.params;
   
  try {
    pgnum = parseInt(pgnum, 10);
    limit = parseInt(limit, 10);
    if(!(typeof pgnum === "number" && typeof limit === "number")) {
      res.status(400).send("Please enter limit and number as valid decimal numbers")
    } 
    if (limit) {
      if (limit > 500) limit = 500;
    }
  } catch(err) {
    console.log(err);
  }


  let skips = limit * (pgnum - 1);
  let numOfTxs : number = await TransactionStorage.collection.find({ chain, network, blockHash }).count();
  try {
    let txs;
    if(numOfTxs < limit) {
      txs = await TransactionStorage.collection.find({ chain, network, blockHash }).toArray();
    } else {
      console.log(limit);
      txs = await TransactionStorage.collection.find({ chain, network, blockHash }).skip(skips).limit(limit).toArray();
    }

    if (!txs) {
      return res.status(422).send("No txs for page");
    }

    const txidIndexes : any= {};
    let txids = txs.map((tx, index) => { txidIndexes[index] = tx.txid; return tx.txid });
    let inputTxidIndexes : any = {};
    let outputTxidIndexes: any = {};

    let inputsPromises = txids.map((txid,index) => {
      try {
        inputTxidIndexes[txid] = index;
        return CoinStorage.collection
          .find({
            chain,
            network,
            spentTxid: txid
          })
          .addCursorFlag('noCursorTimeout', true)
          .toArray();
      }  catch(err) {
        console.log("Error reading inputs", err)
         return err;
      }
    });

    let inputsResults = await Promise.all(inputsPromises).then(inputs => { return inputs; } );

    let outputsPromises = txids.map((txid, index) => {
      try {
        outputTxidIndexes[txid] = index;
        return CoinStorage.collection
          .find({
            chain,
            network,
            mintTxid: txid
          })
          .addCursorFlag('noCursorTimeout', true)
          .toArray();

      } catch (err) {
        console.log("Error reading outputs", err)
        return err;
      }
    });

    let outputsResults = await Promise.all(outputsPromises).then(outputs => { return outputs; });

    let txsResults : any = {};
  
    txids.forEach((txid) => {
      let inputs = inputsResults[inputTxidIndexes[txid]];
      let outputs = outputsResults[outputTxidIndexes[txid]];

      txsResults[txid] = { inputs, outputs }
    });

    let prevPageNum;
    let nxtPageNum;
    let previous: string = ''; 
    let next : string = '';
    if((pgnum !== 1)) {
      prevPageNum = parseInt(pgnum) - 1;
      previous = `/block/${blockHash}/coins/${limit}/${prevPageNum}`;
    } 
    if(numOfTxs - (limit * pgnum) > 0) {
      nxtPageNum = pgnum + 1;
      next = `/block/${blockHash}/coins/${limit}/${nxtPageNum}`;
    }

    return res.json({ txsResults, previous, next });
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

router.get('/before-time/:time', async function(req: Request, res: Response) {
  let { time, chain, network } = req.params;
  try {
    const [block] = await BitcoinBlockStorage.collection
      .find({
        chain,
        network,
        timeNormalized: { $lte: new Date(time) }
      })
      .limit(1)
      .sort({ timeNormalized: -1 })
      .toArray();

    if (!block) {
      return res.status(404).send('block not found');
    }
    const tip = await ChainStateProvider.getLocalTip({ chain, network });
    if (block && tip && tip.height - block.height > Confirmations.Deep) {
      SetCache(res, CacheTimes.Month);
    }
    return res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/block'
};
