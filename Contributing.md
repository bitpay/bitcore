# Submitting Issues
## Bug Reports

A bug is a _demonstrable problem_ that is caused by the code in the repository.
Good bug reports are extremely helpful - thank you!

Guidelines for bug reports:

1. **Use the GitHub issue search** &mdash; Check if the issue has already been
   reported. If it already exists, consider leaving a comment with any extra clarifying
   details about your situation that might help us narrow in on the nature of the problem.

2. **Check if the issue has already been fixed** &mdash; In the event that you are don't 
    have the latest, try to reproduce it using the latest changes in the `master` branch.

3. **Submit a clear and detailed issue** &mdash; Please try to be as detailed as possible 
    in your report. Please include the following:
    - Your environment, OS and/or browsers facing the issue
    - Steps to reproduce the issue
    - Specific errors thrown, stack trace etc.
    - The behaviour you expect vs what it's doing


## Feature Requests

Feature requests are welcome. But take a moment to find out whether your idea
fits with the scope and aims of the project. It's up to *you* to make a strong
case to convince the project's developers of the merits of this feature. Please
provide as much detail and context as possible.


# Contributing Code

Good pull requests - patches, improvements, new features - are a fantastic
help. They should remain focused in scope and avoid containing unrelated
commits.

Please adhere to the coding conventions used throughout this monorepo (indentation,
accurate comments, etc.) and any other requirements (such as test coverage).

Follow this process:

1. [Fork](http://help.github.com/fork-a-repo/) the project, clone your fork,
   and configure the remotes:

   ```bash
   # Clone your fork of the repo into the current directory
   git clone https://github.com/<your-username>/bitcore
   # Navigate to the newly cloned directory
   cd bitcore
   # Assign the original repo to a remote called "upstream"
   git remote add upstream https://github.com/bitpay/bitcore
   ```

2. If you cloned a while ago, get the latest changes from upstream:

   ```bash
   git checkout master
   git pull upstream master
   ```

3. Create a new feature branch (off the `master` branch) to
   contain your feature, change, or fix:

   ```bash
   git checkout -b <feature-branch-name>
   ```

4. Write code and commit your changes in logical chunks.

5. Locally merge (or rebase) the upstream `master` branch into your feature branch:

   ```bash
   git pull [--rebase] upstream master
   ```

6. Push your feature branch up to your fork:

   ```bash
   git push origin <feature-branch-name>
   ```

7. [Open a Merge Request](https://help.github.com/articles/using-pull-requests/)
    with a clear title and description from your fork to the base repository (bitpay/bitcore - master).


