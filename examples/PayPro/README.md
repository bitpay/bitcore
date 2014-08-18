# Running the Payment Protocol Demo

## Node

The node payment protocol demonstration will run automatically via:

``` bash
$ node examples/PayPro`
```

You will see the server and customer logs output in the terminal.

## Browser

To run our payment protocol demonstration in the browser, you may run:

``` bash
$ node examples/PayPro/server.js -b -p 8080
```

This will start the payment protocol demonstration server which serves outputs
in the payment protocol request (which don't ask for *too* many testnet coins).

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
