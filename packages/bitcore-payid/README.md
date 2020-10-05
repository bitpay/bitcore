# Bitcore PayID

## Setup
> npm install

## Usage

### Sign
TODO

### Verify

`verifiableAddress` can be manually constructed as a `IVerifyPayId` object or a `JWK.GeneralJWS` object. Note that the PayId `sign` method returns a JWK.GeneralJWS object.

```javascript
import PayId from 'PayId';

// ...

const isValid = PayId.verify('alice$example.com', verifiableAddress);
```

