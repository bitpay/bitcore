<a name="BlockHeader"></a>
#class: BlockHeader
**Members**

* [class: BlockHeader](#BlockHeader)
  * [new BlockHeader()](#new_BlockHeader)
  * [BlockHeader.fromJSON(json)](#BlockHeader.fromJSON)
  * [BlockHeader.fromRawBlock(data)](#BlockHeader.fromRawBlock)
  * [BlockHeader.fromBuffer(buf)](#BlockHeader.fromBuffer)
  * [BlockHeader.fromString(str)](#BlockHeader.fromString)
  * [BlockHeader.fromBufferReader(br)](#BlockHeader.fromBufferReader)
  * [blockHeader.toObject()](#BlockHeader#toObject)
  * [blockHeader.toJSON()](#BlockHeader#toJSON)
  * [blockHeader.toBuffer()](#BlockHeader#toBuffer)
  * [blockHeader.toString()](#BlockHeader#toString)
  * [blockHeader.toBufferWriter(bw)](#BlockHeader#toBufferWriter)
  * [blockHeader.getTargetDifficulty()](#BlockHeader#getTargetDifficulty)
  * [blockHeader._getHash()](#BlockHeader#_getHash)
  * [blockHeader.validTimestamp()](#BlockHeader#validTimestamp)
  * [blockHeader.validProofOfWork()](#BlockHeader#validProofOfWork)
  * [blockHeader.inspect()](#BlockHeader#inspect)

<a name="new_BlockHeader"></a>
##new BlockHeader()
Instantiate a BlockHeader from a Buffer, JSON object, or Object with
the properties of the BlockHeader

**Params**

-  `*` - A Buffer, JSON string, or Object  

**Returns**: [BlockHeader](#BlockHeader) - - An instance of block header  
<a name="BlockHeader.fromJSON"></a>
##BlockHeader.fromJSON(json)
**Params**

- json `String` | `Object` - A JSON string or object  

**Returns**: [BlockHeader](#BlockHeader) - - An instance of block header  
<a name="BlockHeader.fromRawBlock"></a>
##BlockHeader.fromRawBlock(data)
**Params**

- data `Binary` - Raw block binary data or buffer  

**Returns**: [BlockHeader](#BlockHeader) - - An instance of block header  
<a name="BlockHeader.fromBuffer"></a>
##BlockHeader.fromBuffer(buf)
**Params**

- buf `Buffer` - A buffer of the block header  

**Returns**: [BlockHeader](#BlockHeader) - - An instance of block header  
<a name="BlockHeader.fromString"></a>
##BlockHeader.fromString(str)
**Params**

- str `String` - A hex encoded buffer of the block header  

**Returns**: [BlockHeader](#BlockHeader) - - An instance of block header  
<a name="BlockHeader.fromBufferReader"></a>
##BlockHeader.fromBufferReader(br)
**Params**

- br `BufferReader` - A BufferReader of the block header  

**Returns**: [BlockHeader](#BlockHeader) - - An instance of block header  
<a name="BlockHeader#toObject"></a>
##blockHeader.toObject()
**Returns**: `Object` - - A plain object of the BlockHeader  
<a name="BlockHeader#toJSON"></a>
##blockHeader.toJSON()
**Returns**: `String` - - A JSON string  
<a name="BlockHeader#toBuffer"></a>
##blockHeader.toBuffer()
**Returns**: `Buffer` - - A Buffer of the BlockHeader  
<a name="BlockHeader#toString"></a>
##blockHeader.toString()
**Returns**: `String` - - A hex encoded string of the BlockHeader  
<a name="BlockHeader#toBufferWriter"></a>
##blockHeader.toBufferWriter(bw)
**Params**

- bw `BufferWriter` - An existing instance BufferWriter  

**Returns**: `BufferWriter` - - An instance of BufferWriter representation of the BlockHeader  
<a name="BlockHeader#getTargetDifficulty"></a>
##blockHeader.getTargetDifficulty()
**Returns**: `BN` - - An instance of BN with the decoded difficulty bits  
<a name="BlockHeader#_getHash"></a>
##blockHeader._getHash()
**Returns**: `Buffer` - - The little endian hash buffer of the header  
<a name="BlockHeader#validTimestamp"></a>
##blockHeader.validTimestamp()
**Returns**: `Boolean` - - If timestamp is not too far in the future  
<a name="BlockHeader#validProofOfWork"></a>
##blockHeader.validProofOfWork()
**Returns**: `Boolean` - - If the proof-of-work hash satisfies the target difficulty  
<a name="BlockHeader#inspect"></a>
##blockHeader.inspect()
**Returns**: `String` - - A string formated for the console  
