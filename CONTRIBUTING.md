Contributing to Bitcore
=======

Are you a developer looking to learn more about bitcoin? 
Bitcore is a great opportunity to do so, and give back to
the community. At BitPay we encourage any developer to read the source 
code and help us improve it by fixing bugs, implementing
new exciting features, and testing existing code. 

Pull requests are the standard mechanism by which you contribute code to open-source projects.
To do so, start by forking our repo on GitHub. Go to 
[github.com/bitpay/bitcore](https://github.com/bitpay/bitcore)
and click the 'Fork' button.  You'll get your own fork of the repository which will look something like this:
```
https://github.com/user/bitcore
```

Then clone your fork on your machine:
```
git clone git@github.com:user/bitcore && cd bitcore/
```

Add the official repo as a remote, to track our changes:
```
git remote add bitpay git@github.com:bitpay/bitcore.git
```

Create a new branch for the changes you are going to contribute, with a relevant name. Some examples:
```
git checkout -b test/some-module
git checkout -b feature/some-new-stuff
git checkout -b fix/some-bug 
git checkout -b remove/some-file
```

Work on your changes: 
```
vim somefile.txt
git add somefile.txt
git commit -a -m"adding somefile.txt"
```

When you think your code is ready, update your branch by 
getting the changes from the main repo first, as there may have been
changes while you were working:
```
git pull --rebase bitpay master
```
(You may need to solve any conflicts from the rebase at this point.)

Note that we require rebasing your branch instead of mergeing it, for commit readability reasons. 

A final and important step is to run the tests and check they all pass.
This is done by running `mocha` in the project's directory. You'll also 
need to check that tests pass in the browser, by running:
`grunt shell` and opening the `bitcore/test/index.html` file in your
browser.

After that, you can push the changes to your fork, by doing:
```
git push origin your_branch_name
git push origin feature/some-new-stuff
git push origin fix/some-bug
```

Finally go to [github.com/bitpay/bitcore](https://github.com/bitpay/bitcore) in your
web browser and issue a new pull request. GitHub normally recognizes you have pending
changes in a new branch and will suggest creating the pull request. If it doesn't, you can
always go to [github.com/bitpay/bitcore/compare](https://github.com/bitpay/bitcore/compare) and
choose the correct forks and branches. 

Main contributors will review your code and possibly ask for 
changes before your code is pulled in to the main repository. 
We'll check that all tests pass, review the coding style, and
check for general code correctness. If everything is OK, we'll 
merge your pull request and your code will be part of bitcore.

If you have any questions feel free to post them to
[github.com/bitpay/bitcore/issues](https://github.com/bitpay/bitcore/issues).

Thanks for your time and code!



