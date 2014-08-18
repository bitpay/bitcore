# Running the Payment Protocol Demo

## Node

The node payment protocol demonstration will run automatically via:

``` bash
$ node examples/PayPro
```

You will see the server and customer logs output in the terminal.

## Browser

To run our payment protocol demonstration in the browser, you may run:

``` bash
$ node examples/PayPro/server.js -b -p 8080
```

This will start the payment protocol demonstration server in browser mode,
which serves outputs in the payment protocol request (don't worry, it doesn't
ask for *too* many testnet coins).

Once the server is started, you can visit it in your browser:

``` bash
$ chromium https://localhost:8080/
```

You will see a simple checkout page to buy some imaginary products. Once you
press checkout, you will see all the server and client logs in the browser as
well as the terminal.

If you're connected to enough peers, your transaction will be broadcast
throughout the bitcoin testnet network and hopefully ACKed by your peers.

## Logs

Your logs may ultimately look something like this:

```
Customer: Our payment was acknowledged!
Customer: Message from Merchant: Thank you for your payment!
Customer: Payment sent successfully.
```

## Changing the server address contained in outputs

If you want to alter the address or public key the testnet coins get sent to by
the payment server, you can pass in the `--pubkey` or `--address` options.
`address` has to be a testnet address, whereas `pubkey` is a hex encoded public
key. The `--privkey` option is also available in the standard bitcoind privkey
format.

## Other Options

If you you're not connected to enough peers to broadcast your transaction (by
default, this example only connects to the core seed peers), you can enable
peer discovery in bitcore by passing the `--discovery` (`-d`) argument onto the
server command line.

If you don't want to actually broadcast your transaction and want to keep your
testnet coins, you can pass `--no-tx` on the server command line.

If you don't want the tests to run automatically and simply host the payment
server, simply pass `--browser` (`-b`) as mentioned above.

## Using the example in a modular manner

``` js
var server = require('bitcore/examples/PayPro');
server.listen(8080);
```
