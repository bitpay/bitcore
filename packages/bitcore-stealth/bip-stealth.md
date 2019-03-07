<pre>
  BIP: XX
  Title: Stealth Payments
  Authors: Peter Todd <pete@petertodd.org>
  Status: Final
  Type: Standards Track
  Created: 2015-01-16
</pre>

==Abstract==

Stealth payments enable a single address to be publically published, and to
receive payments without any form of communication between sender and
recipient.

The recipient is able to scan the blockchain to find payments destined for
themselves. This BIP solely concerns the stealth mechanism.

==Motivation==

Current best practice mandates users to create a new Bitcoin address for
every new received payment to maintain privacy. However in practice this
represents a huge usability burden for users, and exposes users to a potential
side-channel attack on their privacy. Stealth payments enable anonymous
payments on the sending side, even on a compromised connection.

==Address format==

Mainnet version = 0x2a (42), testnet version = 0x2b (43)

<pre>
  [version:1=0x2a] [options:1] [scan_pubkey:33] [N:1] [spend_pubkey_1:33] ...
    [spend_pubkey_N:33] [number_sigs:1] [prefix_length:1] [prefix:prefix_length/8, round up]

  options bitfield = 0 or 1 (reuse scan_pubkey for spends)
</pre>

When we wish to make a transaction (as a sender) that the recipient can
discover, we must brute-force nonce values (grind) that produces the correct
prefix so the hash of ephemkey output produces the correct stealth_prefix as
specified in the stealth address. 

<pre>
def number_prefix_bytes(prefix_bits_length)
    if prefix_bits_length == 0:
        return 0
    return prefix_bits_length / 8 + 1
</pre>

==Transaction Format==

Stealth metadata always occurs pairwise preceeding the output:

<pre>
 * out #1 - metadata for spend A
 * out #2 - stealth spend A
 * out #3 - metadata for spend B
 * out #4 - stealth spend B
 * out #5 - regular spend C
 * out #6 - metadata for spend D
 * out #7 - stealth spend D
 * out #8 - regular spend E
 * out #9 - regular spend F
 * out #10 - metadata for spend G
 * out #11 - stealth spend G
</pre>

===Output Format===

<pre>
  P = ephemeral pubkey created by sender
</pre>

Transactions encode the ephemkey in this format: 

<pre>
tx outputs:
-> RETURN <P:32> ...
-> DUP HASH160 <pkh:20> EQUALVERIFY CHECKSIG
</pre>

The remaining space in the RETURN output is reserved for future stealth
address features.

By convention only public keys beginning with 02 will be used for the
scan pubkey. The client will generate keys until finding one beginning with
02.

==Deriving Keys==

Receiver:

<pre>
Q = public key (EC point, 33 bytes)
d = private key (integer, 32 bytes)

Q = dG
</pre>

Sender (has Q, not d):

<pre>
P = eG
</pre>

By publishing P, only sender and receiver have access to c:

<pre>
c = H(eQ) = H(dP)
</pre>

Sender:

<pre>
Q' = Q + cG
</pre>

Receiver:

<pre>
Q' = Q + cG = (d + c)G

private key = d + c [Remember: mod curve.order and pad with 0x00s where
necessary]
</pre>

===Reuse Scan-Pubkey===

Say we want to keep our stealth spending key private, yet still be able to scan
for payments to us. Normally to scan a stealth payment, we need to decrypt our
stealth key to see if payments are received. This is unacceptable for wallets to
do without user interaction as it risks compromising their wallet.

We can instead use a dual-key stealth scheme. 

Receiver:

<pre>
Q = public scan key (EC point, 33 bytes)
d = private scan key (integer, 32 bytes)
R = public spend key
f = private spend key

Q = dG  (scan)
R = fG  (spend)

stealth address: <scan=Q> <spend=R, ...>
</pre>

Sender (has Q, not d):

<pre>
P = eG (ephemeral)
</pre>

By publishing P, only sender and receiver have access to c:

<pre>
c = H(eQ) = H(dP)
</pre>

Sender:

<pre>
R' = R + cG
</pre>

Receiver:

<pre>
R' = R + cG     [without decrypting wallet]
   = (f + c)G   [after decryption of wallet]
     [Remember: mod curve.order and pad with 0x00s where necessary]
</pre>

In this scheme, we can use the scan keypair (Q, d) to generate the shared secret
c, and then hence derive the address from the public part R. 

==Test Vectors==

===Scanning for rows based off stealth prefix===

<pre>
~/worker/blockchain$ block_db last_height blocks_lookup blocks_rows
338286
</pre>

<pre>
~/worker/blockchain$ stealth_db scan
Usage: stealth_db scan INDEX ROWS PREFIX FROM_HEIGHT
</pre>

<pre>
~/worker/blockchain$ stealth_db scan stealth_index stealth_rows 100010010 0
Ephemkey: 4f41010001a08d061b753d68747470733a2f2f6370722e736d2f624e56387837
Address: 80a908a7afd284ce51416d1acb9cce310104874d
Tx hash: 87164d76a0217adaa26c0938dd34152cbcb92026b4e443d043031f1634a4ab91

Ephemkey: 4f41010001e8071b753d68747470733a2f2f6370722e736d2f6552544c71506f
Address: 00bbb1a2a970410a015320ccea65deb44b48d337
Tx hash: e9b9a7f901b633a5c2d368a5143edd8b0ea2c02430849b0e449cfc748db98318

Ephemkey: 4f410100010a1b753d68747470733a2f2f6370722e736d2f75764769644c5f74
Address: af7dcdba3432a447afd077271923cc80e40fc639
Tx hash: 724925429b5447026179146e7d8cb2034984629d89d20ce6c30aa2944bd5a2d8

Ephemkey: 060f94c45703924e55ba2dfd74ace52b74f56e7f4873765f121cb2f5a1882327
Address: fe4ca30c546c3b43be42ab4e92dbfe661a9b7878
Tx hash: 8e67e6ba349e94fe6ef96999ce88dcc1f780d2dfc50cafb30339dafe06aaa7ae

Ephemkey: 061eba8f65022e3cce87e1a7662417c0d0559b109181e55ceedf5775cbaeaaf5
Address: b4ef2e78bad43c597c81f33eda982ec0ebab4e1c
Tx hash: 478ccd767260adbf14f93280703c62e399dea8e8f9048377957a52bbb19cadf6

Ephemkey: 4f41010001f4031b753d68747470733a2f2f6370722e736d2f7337586c30796b
Address: 24e5368bee20f8c5e5e5c735cda036ccbb56205a
Tx hash: 930283ba8d44367239c206cf55968bfa71396f462b5905af2265ccd7e61cfa69

Ephemkey: 4f410100100ad804db0b0aac02b7d302ac02ac02997ce2040af20c64f4038191
Address: 59717775f32282d4b5c234d985023d891a92db58
Tx hash: 048eb7246358f1389e3bf2f15e261efead8c9a22871421b7acffb2877e086c8c
</pre>

<pre>
~/worker/blockchain$ stealth_db scan stealth_index stealth_rows 01010101010 0
</pre>

<pre>
~/worker/blockchain$ stealth_db scan stealth_index stealth_rows 01010101 0
Ephemkey: 0665b0e7e50309d0f22d3c45616cb862ba4834d68db36958ee924505c6701bfd
Address: 0e8512e0b8e68dff7e79458a68db5a331361091c
Tx hash: 59b5c54af868e80aff6706ee627beb04d835f5abf3def1d8c60483d8b17eccbd

Ephemkey: 4f4101000180c8afa0251b753d68747470733a2f2f6370722e736d2f47505139
Address: 1a6adc15291555d2a74ea9955e6c623180dd5279
Tx hash: dc9c087c2752b7e2339116e25f341fde47655e638fc5d8aad9620bef5f0b3af8

Ephemkey: 0663306ed402e9b470d57eb92bfcb36bdf27413e815767b5f2a9c2f267c7b1fc
Address: cc190676f1e91cf5c77d256d7011ee3be9f2200e
Tx hash: b17124b2058a601682ece0dd6471abe631f0e3d93a10f141004bd49225b30610

Ephemkey: 4f41010001e8071b753d68747470733a2f2f6370722e736d2f3954627276364a
Address: 107be1ad519802a7d62db6f093b3a83c86e7debb
Tx hash: e504b7cfb82443f711213ef18a73b6eb998640a83d31b12454cf91eb199a67d8
</pre>

<pre>
~/worker/blockchain$ stealth_db scan stealth_index stealth_rows 010111101 0
Ephemkey: 0685893aef03b9cafc9cb62787d07ab4a5e3564413225b4603c1cdc28781c9c3
Address: cf1140b10da5a16d9eeb605914c06e9add7359a9
Tx hash: b9f1ee860c3df0282ba342e568405d8f3edf00818225102112166f4d15e04832

Ephemkey: 4f410100109e78b80ed706d7066666c12cbc02bc02c3eb018a0d8a0de807e807
Address: 6485798119fc5474556aa8fdea25581009835061
Tx hash: 90affa3c69e2b9e724d4e90d3e26785d352c570033668944331ec394b7323df8

Ephemkey: 4f410100100a90030a0af908e3ec020a0a64b8170aabc2020a8028ab02d7a0ad
Address: b3b920f1cb33512e8e8360e517d684ebd558ae1b
Tx hash: 01474e191ddf7340a45e97e4683553d4f1c7ac1de96e6472e404ea74b43499df
</pre>

===Prefix Matching===

Taking the first example above:
https://blockchain.info/rawtx/87164d76a0217adaa26c0938dd34152cbcb92026b4e443d043031f1634a4ab91

script RETURN output is:
<pre>
6a244f41010001a08d061b753d68747470733a2f2f6370722e736d2f624e563878374d527a77
</pre>

<pre>
$ python
>>> import hashlib
>>> hashlib.sha256(hashlib.sha256("6a244f4...".decode("hex")).digest()).digest().encode("hex")
'89556cc68bc8139e0de4d103502b3b413091b0a6a61a17ccb4d2a68c5b0743da'
</pre>

<pre>
89 is 10001001
55 is 01010101
6c is 01101100
</pre>

prefix is therefore:
<pre>
10001001 + 01010101 + 01101100
100010010101010101101100
</pre>

== Sources ==

* libbitcoin:
** [https://github.com/libbitcoin/libbitcoin-blockchain/blob/master/include/bitcoin/blockchain/database/stealth_database.hpp <bitcoin/blockchain/database/stealth_database.hpp>]
** [https://github.com/libbitcoin/libbitcoin-blockchain/blob/master/src/database/stealth_database.cpp src/blockchain/database/stealth_database.cpp]
** Stealth prefix comparison algorithm: [https://github.com/libbitcoin/libbitcoin/blob/master/include/bitcoin/bitcoin/stealth.hpp <bitcoin/bitcoin/stealth.hpp>] [https://github.com/libbitcoin/libbitcoin/blob/master/src/stealth.cpp src/stealth.cpp]
* python-obelisk:
** Example: [https://github.com/darkwallet/python-obelisk/blob/master/examples/chain-test.py#L60 examples/chain-test.py]
** API method: [https://github.com/darkwallet/python-obelisk/blob/master/obelisk/client.py#L205 obelisk/client.py]
* Websockets gateway:
** JavaScript API method: [https://github.com/darkwallet/gateway/blob/master/client/gateway.js#L95 gateway.js]
** Example HTML: [https://github.com/darkwallet/gateway/blob/master/client/test.html#L76 test.html]
** Server gateway handler: [https://github.com/darkwallet/gateway/blob/master/daemon/obelisk_handler.py#L227 obelisk_handler.py]
* DarkWallet:
** Stealth generate address: [https://github.com/darkwallet/darkwallet/blob/develop/src/js/util/stealth.js stealth.js]
** Receive stealth payments from Obelisk backend (old style single scan_pubkey): [https://github.com/darkwallet/darkwallet/blob/develop/src/js/frontend/controllers/rcv_stealth.js rcv_stealth.js]

