# Block

A Block instance represents the information on a block in the bitcoin network.
Note that creating it takes some computing power, as the tree of transactions
is created or verified.

Given a hexa or base64 string representation of the serialization of a block
with its transactions, you can instantiate a Block instance. It will calculate
and check the merkle root hash (if enough data is provided), but transactions
won't neccesarily be valid spends, and this class won't validate them. A binary
representation as a `Buffer` instance is also valid input for a Block's
constructor.

```javascript
assert(Block.isValidHeader(data);
assert(Block.isValidBlock(data);

var block = new Block(hexaEncodedBlock);
assert(block.id && block.hash && block.id === block.hash);
assert(block.version === Block.CurrentVersion);
assert(block.prevHash);
assert(block.timestamp);
assert(block.nonce);
assert(block.size);
assert(block.transactions[0] instanceof Transaction);
```

## Navigating through transactions

The set of transactions in a block can be explored by iterating on the block's
`transactions` member.

```javascript
for (var transaction in block.transactions) {
  // ...
}
```

It is also possible to explore a block's Merkle tree of transaction hashes.
Head to the [Merkle tree](./DataStructures.html#MerkleTree) documentation for
more information:

```javascript
var root = block.tree.root;
assert(root instanceof bitcore.DataStructures.MerkleTree.Node);
assert(root.hash === block.id);
assert(root.isLeaf === false);
assert(root.left instanceof bitcore.DataStructures.MerkleTree.Node);
assert(root.right instanceof bitcore.DataStructures.MerkleTree.Node);
assert(root.left.left.left.left.content === block.transactions[0]);
```
