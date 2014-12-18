<a name="Block"></a>
#class: Block
Block
Instantiate a Block from a Buffer, JSON object, or Object with
the properties of the Block

**Members**

* [class: Block](#Block)
  * [new Block(arg)](#new_Block)
  * [block.magicnum](#Block#magicnum)
  * [block.size](#Block#size)
  * [block.header](#Block#header)
  * [block.txs](#Block#txs)
  * [Block.fromJSON(json)](#Block.fromJSON)
  * [Block.fromBufferReader(br)](#Block.fromBufferReader)
  * [Block.fromBuffer(buf)](#Block.fromBuffer)
  * [Block.fromString(str)](#Block.fromString)
  * [Block.fromRawBlock(data)](#Block.fromRawBlock)
  * [block.toObject()](#Block#toObject)
  * [block.toJSON()](#Block#toJSON)
  * [block.toBuffer()](#Block#toBuffer)
  * [block.toString()](#Block#toString)
  * [block.toBufferWriter(bw)](#Block#toBufferWriter)
  * [block.getTransactionHashes()](#Block#getTransactionHashes)
  * [block.getMerkleTree()](#Block#getMerkleTree)
  * [block.getMerkleRoot()](#Block#getMerkleRoot)
  * [block.validMerkleRoot()](#Block#validMerkleRoot)
  * [block._getHash()](#Block#_getHash)
  * [block.inspect()](#Block#inspect)

<a name="new_Block"></a>
##new Block(arg)
**Params**

- arg `*` - A Buffer, JSON string, or Object  

**Returns**: [Block](#Block)  
<a name="Block#magicnum"></a>
##block.magicnum
**Type**: `number`  
<a name="Block#size"></a>
##block.size
**Type**: `number`  
<a name="Block#header"></a>
##block.header
**Type**: `BlockHeader`  
<a name="Block#txs"></a>
##block.txs
**Type**: `Array.<Transaction>`  
<a name="Block.fromJSON"></a>
##Block.fromJSON(json)
**Params**

- json `String` | `Object` - A JSON string or object  

**Returns**: [Block](#Block) - - An instance of block  
<a name="Block.fromBufferReader"></a>
##Block.fromBufferReader(br)
**Params**

- br `BufferReader` - A buffer reader of the block  

**Returns**: [Block](#Block) - - An instance of block  
<a name="Block.fromBuffer"></a>
##Block.fromBuffer(buf)
**Params**

- buf `Buffer` - A buffer of the block  

**Returns**: [Block](#Block) - - An instance of block  
<a name="Block.fromString"></a>
##Block.fromString(str)
**Params**

- str `String` - str - A hex encoded string of the block  

**Returns**: [Block](#Block) - - A hex encoded string of the block  
<a name="Block.fromRawBlock"></a>
##Block.fromRawBlock(data)
**Params**

- data `Binary` - Raw block binary data or buffer  

**Returns**: [Block](#Block) - - An instance of block  
<a name="Block#toObject"></a>
##block.toObject()
**Returns**: `Object` - - A plain object with the block properties  
<a name="Block#toJSON"></a>
##block.toJSON()
**Returns**: `String` - - A JSON string  
<a name="Block#toBuffer"></a>
##block.toBuffer()
**Returns**: `Buffer` - - A buffer of the block  
<a name="Block#toString"></a>
##block.toString()
**Returns**: `String` - - A hex encoded string of the block  
<a name="Block#toBufferWriter"></a>
##block.toBufferWriter(bw)
**Params**

- bw `BufferWriter` - An existing instance of BufferWriter  

**Returns**: `BufferWriter` - - An instance of BufferWriter representation of the Block  
<a name="Block#getTransactionHashes"></a>
##block.getTransactionHashes()
Will iterate through each transaction and return an array of hashes

**Returns**: `Array` - - An array with transaction hashes  
<a name="Block#getMerkleTree"></a>
##block.getMerkleTree()
Will build a merkle tree of all the transactions, ultimately arriving at
a single point, the merkle root.

**Returns**: `Array` - - An array with each level of the tree after the other.  
<a name="Block#getMerkleRoot"></a>
##block.getMerkleRoot()
Calculates the merkleRoot from the transactions.

**Returns**: `Buffer` - - A buffer of the merkle root hash  
<a name="Block#validMerkleRoot"></a>
##block.validMerkleRoot()
Verifies that the transactions in the block match the header merkle root

**Returns**: `Boolean` - - If the merkle roots match  
<a name="Block#_getHash"></a>
##block._getHash()
**Returns**: `Buffer` - - The little endian hash buffer of the header  
<a name="Block#inspect"></a>
##block.inspect()
**Returns**: `String` - - A string formated for the console  
