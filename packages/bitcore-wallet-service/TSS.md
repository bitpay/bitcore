# DKG
This document explains the specs for the client implementation of distributed key generation (DKG) for the threshold signature scheme (TSS).


### Asynchronous DKG
If the DKG ceremony is executed asynchronously (meaning all parties are not required to be online at the same time during the DKG), the `keyGen.export()` function should be used between each step to export the local session state. The session state should be securely stored and used with `KeyGen.restore()` for following steps.

### Flow Diagram
![DKG Flow](https://drive.google.com/uc?export=view&id=1A-zzWamhDmFzPY7GUqYNvc8BFHMUM22c)

### API Spec
<details>
<summary style="font-size:17px"><span style="font-weight:bold">POST</span> /v1/tss/keygen</summary>

Initialize the `KeyGen` class with a seed that is the derived private key.

> E.g.: given your HD master key, derive an Ethereum key along the Ethereum standard path m/44'/60'/0'/\<index>. The resulting private key will be the seed for the KeyGen class.

**If you are creating a session**, your partyId should be 0.

**If you are joining a session**, the join code should have your partyId.

### Request body:
```typescript
{
  sessionId: string,
  message: {
    partyId: number,
    publicKey: string,
    broadcastMessages: Array<string>
  }
}

```

### Response body:
```typescript
{
  error?: string,
  result?: {
    sessionId: string
  }
}
```

</details>

<details>
<summary style="font-size:17px"><span style="font-weight:bold">GET</span> /v1/tss/keygen/:id/:round</summary>

### Request body:
```typescript
None
```

### Response body:
```typescript
{
  error?: string,
  result?: {
    sessionId: string,
    round: number,
    messages: Array<{
      partyId: number,
      publicKey: string,
      p2pMessages: Array<string>,
      broadcastMessages: Array<string>
    }>,
  }
}
```
</details>

<details>
<summary style="font-size:17px"><span style="font-weight:bold">POST</span> /v1/tss/keygen/:id</summary>

### Request body:
```typescript
{
  message?: { // provided during rounds
    round: number,
    partyId: number,
    publicKey: string,
    p2pMessages: Array<string>,
    broadcastMessages: Array<string>
  },
  address?: string, // provided after the final round
}
```

### Response body:
```typescript
{
  error?: string,
}
```
</details>

<details>
<summary style="font-size:17px"><span style="font-weight:bold">POST</span> /v1/tss/keygen/:id/store</summary>

> THIS IS A SUB-OPTIMAL ENDPOINT. We do NOT want users to be dependent on our servers for recovering their funds. However, this is a stop-gap until we have DKG recovery implemented.

### Request body:
```typescript
{
  keychain?: string, // keychain encrypted with seed (or perhaps a derivation of seed?)
}
```

### Response body:
```typescript
{
  error?: string,
}
```
</details>

<span style="padding:20px"> </span>

# DSG

### Asynchronous DSG
If the DSG ceremony is executed asynchronously (meaning all signing parties are not required to be online at the same time during the DSG), the `sign.export()` function should be used between each step to export the local session state. The session state should be securely stored and used with `Sign.restore()` for following steps.

### Flow Diagram
![DKG Flow](https://drive.google.com/uc?export=view&id=1cU_m5wzpPUCcrhTIS0-gWWopdOIa_wYx)

### API Spec
<details>
<summary style="font-size:17px"><span style="font-weight:bold">POST</span> /v1/tss/sign</summary>

### Request body:
```typescript
{
  sessionId: string,
  message: {
    partyId: number,
    publicKey: string,
    broadcastMessages: Array<string>
  }
}

```

### Response body:
```typescript
{
  error?: string,
  result?: {
    sessionId: string
  }
}
```

</details>

<details>
<summary style="font-size:17px"><span style="font-weight:bold">GET</span> /v1/tss/sign/:id/:round</summary>

### Request body:
```typescript
None
```

### Response body:
```typescript
{
  error?: string,
  result?: {
    sessionId: string,
    round: number,
    messages: Array<{
      partyId: number,
      publicKey: string,
      p2pMessages: Array<string>,
      broadcastMessages: Array<string>
    }>,
  }
}
```
</details>

<details>
<summary style="font-size:17px"><span style="font-weight:bold">POST</span> /v1/tss/sign/:id</summary>

### Request body:
```typescript
{
  message?: { // provided during rounds
    round: number,
    partyId: number,
    publicKey: string,
    p2pMessages: Array<string>,
    broadcastMessages: Array<string>
  },
  signature?: string, // provided after the final round
}
```

### Response body:
```typescript
{
  error?: string,
}
```
</details>