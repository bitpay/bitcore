# Canonical ERC-20 effects

## Stored field

Confirmed EVM transactions may contain an additive, inclusion-bound field:

```json
{
  "erc20Effects": {
    "blockHash": "0x...",
    "version": 1,
    "items": []
  }
}
```

`items: []` is an authoritative successful result with no supported ERC-20
`Transfer(address,address,uint256)` logs. Absence means materialization has not
successfully completed for that inclusion. The existing `effects` field is not
rewritten; local readers compose their established public `effects` response
from legacy non-ERC-20 entries plus valid canonical items.

Version 1 accepts exactly three-topic `Transfer` logs with a 32-byte amount.
Four-topic ERC-721-shaped logs and other nonstandard Transfer-shaped logs are
counted and ignored. Malformed RPC data, removed logs, duplicate log identities,
block-hash mismatches, and logs for transactions outside the prepared block fail
the block before persistence. Raw logs and receipts are not stored by this
feature.

## Configuration and rollout

Configuration is per EVM chain/network:

```json
{
  "erc20Effects": {
    "materializationEnabled": true,
    "strictReadActivationHeight": 22000000
  }
}
```

`materializationEnabled` makes every confirmed block processed by an upgraded
writer receive a version-1 result, including replayed blocks below the read
boundary. `strictReadActivationHeight` controls reads only: at or above that
height, a missing, malformed, unsupported-version, or inclusion-mismatched
result suppresses legacy heuristic ERC-20 entries while preserving all
non-ERC-20 effects.

Deploy materialization-aware readers/writers to every EVM writer before enabling
materialization. Mixed old/new canonical writers are not supported. During a
coordinated rollback, confirmed persistence preserves a numerically newer stored
generation while continuing ordinary transaction updates and wallet merges. A
typical rollout enables live materialization, chooses an activation height at or
ahead of the deployment tip, backfills lower heights, validates coverage, and
later moves or removes the compatibility boundary.

## Online backfill

Build `@bitpay-labs/bitcore-node`, then run:

```sh
node build/scripts/backfillErc20Effects.js \
  --chain ETH \
  --network mainnet \
  --start-height 18000000 \
  --end-height 18099999 \
  --concurrency 4 \
  --delay-ms 100 \
  --dry-run
```

Remove `--dry-run` to publish. `--concurrency` bounds transaction updates within
one block; blocks are processed in deterministic ascending-height order.
`--delay-ms` throttles block-to-block RPC and MongoDB load. The script emits the
last completed height for explicit-start resumability. `--force-current-version`
re-publishes version 1, but no mode overwrites a version newer than the running
binary.

Each transaction update is conditional on `_id`, chain/network, txid, observed
block height/hash, the observed prior `erc20Effects` value, and a parser-version
predicate. Writes are limited to `erc20Effects` plus wallet-ID `$addToSet`
merges. The script also verifies that the exact local processed block hash and
ordered transaction membership still match the RPC's canonical block before
publication. A changed inclusion or concurrent non-identical publication loses the
conditional update and aborts the block without repairing shared block state.
After changed canonical ERC-20 effects are published, cache invalidation is limited to the
canonical token/address participants; authoritative empty results do not churn
native-balance cache entries.

## Address-history indexes

Two partial multikey indexes preserve existing local address-history parity:

- `{ chain, network, "erc20Effects.items.to", blockTimeNormalized }`
- `{ chain, network, "erc20Effects.items.from", blockTimeNormalized }`

Each canonical transfer contributes one entry to each index. A practical
order-of-magnitude estimate is roughly 200–400 bytes of combined index storage
per materialized transfer after address, chain/network, time, record identifier,
and B-tree overhead, but actual size depends on MongoDB version, prefix
compression, chain/network string lengths, and storage engine settings. Operators
should measure representative blocks before a large backfill and provision
index build I/O and disk headroom accordingly.
