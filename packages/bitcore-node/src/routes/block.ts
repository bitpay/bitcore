import { Request, Response } from "express";
import { ChainStateProvider } from "../providers/chain-state";
const router = require("express").Router({ mergeParams: true });

router.get("/", async function(req: Request, res: Response) {
  let { chain, network, sinceBlock, limit } = req.params;
  try {
    let payload = {
      chain,
      network,
      sinceBlock,
      args: { limit }
    };
    let block = await ChainStateProvider.getBlocks(payload);
    if (!block) {
      return res.status(404).send("block not found");
    }
    return res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get("/:blockId", async function(req: Request, res: Response) {
  let { blockId, chain, network } = req.params;
  try {
    let block = await ChainStateProvider.getBlock({chain, network, blockId});
    if (!block) {
      return res.status(404).send("block not found");
    }
    return res.json(block);
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: "/block"
};
