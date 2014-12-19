<a name="Point"></a>
#class: Point
**Extends**: `elliptic.curve.point`  
**Members**

* [class: Point](#Point)
  * [new Point(x, y)](#new_Point)
  * [Point.fromX(odd, x)](#Point.fromX)
  * [Point.getG()](#Point.getG)
  * [Point.getN()](#Point.getN)
  * [point.getX()](#Point#getX)
  * [point.getY()](#Point#getY)
  * [point.validate(An)](#Point#validate)

<a name="new_Point"></a>
##new Point(x, y)
Instantiate a valid secp256k1 Point from the X and Y coordinates.

**Params**

- x `BN` | `String` - The X coordinate  
- y `BN` | `String` - The Y coordinate  

**Extends**: `elliptic.curve.point`  
**Type**: `Error`  
**Returns**: [Point](#Point) - An instance of Point  
<a name="Point.fromX"></a>
##Point.fromX(odd, x)
Instantiate a valid secp256k1 Point from only the X coordinate

**Params**

- odd `boolean` - If the Y coordinate is odd  
- x `BN` | `String` - The X coordinate  

**Type**: `Error`  
**Returns**: [Point](#Point) - An instance of Point  
<a name="Point.getG"></a>
##Point.getG()
Will return a secp256k1 ECDSA base point.

**Returns**: [Point](#Point) - An instance of the base point.  
<a name="Point.getN"></a>
##Point.getN()
Will return the max of range of valid private keys as governed by the secp256k1 ECDSA standard.

**Returns**: `BN` - A BN instance of the number of points on the curve  
<a name="Point#getX"></a>
##point.getX()
Will return the X coordinate of the Point

**Returns**: `BN` - A BN instance of the X coordinate  
<a name="Point#getY"></a>
##point.getY()
Will return the Y coordinate of the Point

**Returns**: `BN` - A BN instance of the Y coordinate  
<a name="Point#validate"></a>
##point.validate(An)
Will determine if the point is valid

**Params**

- An <code>[Point](#Point)</code> - instance of Point  

**Type**: `Error`  
**Returns**: [Point](#Point) - An instance of the same Point  
