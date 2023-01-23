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


Skip to content
Search or jump to…
Pull requests
Issues
Codespaces
Marketplace
Explore
 
@zakwarlord7 
Your account has been flagged.
Because of that, your profile is hidden from the public. If you believe this is a mistake, contact support to have your account status reviewed.
github
/
docs
Public
Fork your own copy of github/docs
Code
Issues
101
Pull requests
333
Discussions
Actions
Projects
3
Security
Insights
Update and rename CONTRIBUTING.md to bitore.sig #23408
 Closed
zakwarlord7 wants to merge 1 commit into github:main from zakwarlord7:patch-661
+40 −95 
 Conversation 0
 Commits 1
 Checks 0
 Files changed 2
Conversation
zakwarlord7
zakwarlord7 commented now
Uploading BANDOS BITCOIN EXAMPLE OF WHAT THE DROP .IMG HERE YEELLOW BOX READ WHEN IT SAW THE BAASNDOS CHEST PLATE BECAUSE IT WAS A GOLD~LOOKED FOR AND THING THATS ITS NOST PROMINEINT AD CLOSEST TO THAT ITEM ID SINCE I PUT IN 11880 OR 11890COIN t_20210117-113544.png…

Why:
Closes ISSUE

What's being changed (if available, include any code snippets, screenshots, or gifs):
Check off the following:
 I have reviewed my changes in staging (look for the "Automatically generated comment" and click the links in the "Preview" column to view your latest changes).
 For content changes, I have completed the self-review checklist.
@zakwarlord7
Update and rename CONTRIBUTING.md to bitore.sig
0909d2c
@zakwarlord7
Author
zakwarlord7 commented now
From 0909d2c Mon Sep 17 00:00:00 2001
From: "ZACHRY T WOODzachryiixixiiwood@gmail.com"
109656750+zakwarlord7@users.noreply.github.com
Date: Mon, 23 Jan 2023 14:20:15 -0600
Subject: [PATCH] Update and rename CONTRIBUTING.md to bitore.sig

CONTRIBUTING.md | 95 -------------------------------------------------
bitore.sig | 40 +++++++++++++++++++++
2 files changed, 40 insertions(+), 95 deletions(-)
delete mode 100644 CONTRIBUTING.md
create mode 100644 bitore.sig

diff --git a/CONTRIBUTING.md b/CONTRIBUTING.md
deleted file mode 100644
index a3c8ec603b8..00000000000
--- a/CONTRIBUTING.md
+++ /dev/null
@@ -1,95 +0,0 @@
-# Welcome to GitHub docs contributing guide
-Thank you for investing your time in contributing to our project! Any contribution you make will be reflected on docs.github.com ✨.
-Read our Code of Conduct to keep our community approachable and respectable.
-In this guide you will get an overview of the contribution workflow from opening an issue, creating a PR, reviewing, and merging the PR.
-Use the table of contents icon  on the top left corner of this document to get to a specific section of this guide quickly.
-## New contributor guide
-To get an overview of the project, read the README. Here are some resources to help you get started with open source contributions:
-- Finding ways to contribute to open source on GitHub
-- Set up Git
-- GitHub flow
-- Collaborating with pull requests
-## Getting started
-To navigate our codebase with confidence, see the introduction to working in the docs repository 🎊. For more information on how we write our markdown files, see the GitHub Markdown reference.
-Check to see what types of contributions we accept before making changes. Some of them don't even require writing a single line of code ✨.
-### Issues
-#### Create a new issue
-If you spot a problem with the docs, search if an issue already exists. If a related issue doesn't exist, you can open a new issue using a relevant issue form.
-#### Solve an issue
-Scan through our existing issues to find one that interests you. You can narrow down the search using labels as filters. See Labels for more information. As a general rule, we don’t assign issues to anyone. If you find an issue to work on, you are welcome to open a PR with a fix.
-### Make Changes
-#### Make changes in the UI
-Click Make a contribution at the bottom of any docs page to make small changes such as a typo, sentence fix, or a broken link. This takes you to the .md file where you can make your changes and create a pull request for a review.

-#### Make changes in a codespace
-For more information about using a codespace for working on GitHub documentation, see "Working in a codespace."
-#### Make changes locally
-1. Fork the repository.
-- Using GitHub Desktop:

Getting started with GitHub Desktop will guide you through setting up Desktop.
Once Desktop is set up, you can use it to fork the repo!
-- Using the command line:

Fork the repo so that you can make your changes without affecting the original project until you're ready to merge them.
-2. Install or update to Node.js, at the version specified in .node-version. For more information, see the development guide.
-3. Create a working branch and start with your changes!
-### Commit your update
-Commit the changes once you are happy with them. Don't forget to self-review to speed up the review process⚡.
-### Pull Request
-When you're finished with the changes, create a pull request, also known as a PR.
-- Fill the "Ready for review" template so that we can review your PR. This template helps reviewers understand your changes as well as the purpose of your pull request.
-- Don't forget to link PR to issue if you are solving one.
-- Enable the checkbox to allow maintainer edits so the branch can be updated for a merge.
-Once you submit your PR, a Docs team member will review your proposal. We may ask questions or request additional information.
-- We may ask for changes to be made before a PR can be merged, either using suggested changes or pull request comments. You can apply suggested changes directly through the UI. You can make any other changes in your fork, then commit them to your branch.
-- As you update your PR and apply changes, mark each conversation as resolved.
-- If you run into any merge issues, checkout this git tutorial to help you resolve merge conflicts and other issues.
-### Your PR is merged!
-Congratulations 🎉🎉 The GitHub team thanks you ✨.
-Once your PR is merged, your contributions will be publicly visible on the GitHub docs.
-Now that you are part of the GitHub docs community, see how else you can contribute to the docs.
-## Windows
-This site can be developed on Windows, however a few potential gotchas need to be kept in mind:
-1. Regular Expressions: Windows uses \r\n for line endings, while Unix-based systems use \n. Therefore, when working on Regular Expressions, use \r?\n instead of \n in order to support both environments. The Node.js os.EOL property can be used to get an OS-specific end-of-line marker.
-2. Paths: Windows systems use \ for the path separator, which would be returned by path.join and others. You could use path.posix, path.posix.join etc and the slash module, if you need forward slashes - like for constructing URLs - or ensure your code works with either.
-3. Bash: Not every Windows developer has a terminal that fully supports Bash, so it's generally preferred to write scripts in JavaScript instead of Bash.
-4. Filename too long error: There is a 260 character limit for a filename when Git is compiled with msys. While the suggestions below are not guaranteed to work and could cause other issues, a few workarounds include:

Update Git configuration: git config --system core.longpaths true
Consider using a different Git client on Windows
diff --git a/bitore.sig b/bitore.sig
new file mode 100644
index 00000000000..63be26fe111
--- /dev/null
+++ b/bitore.sig
@@ -0,0 +1,40 @@
+on:
push:
branches: master
pull_request:
run-on: ubuntu-latest
steps:
name: Set up Git repository
 uses: actions/checkout@v3
name: Set up Ruby
 uses: ruby/setup-ruby@v1
 with:
   bundler-cache: true
name: Set up Node
 uses: actions/setup-node@v3
name: Bootstrap
 run: script/bootstrap
name: Tests
 run: script/test 
+
+charmap keyset = new
+{ "new keymap Charset = Pro" }
+

   <clear />
   <add key="github" value="https://nuget.pkg.github.com/OWNER/index.json" />
   <github>
       <add key="Username" value="USERNAME" />
       <add key="ClearTextPassword" value="TOKEN" />
   </github>
+
+on:
+Runs-on🔛"
+const: "token"''
+token: "((c)(r))"''
+'Value": "[VOLUME]'"''

'[VOLUME']": "[12753750.[00]m]BITORE_34173.1337_18893":,
:Build::
@zakwarlord7 zakwarlord7 closed this now
Closed with unmerged commits
This pull request is closed, but the zakwarlord7:patch-661 branch has unmerged commits.

@zakwarlord7

 
Add heading textAdd bold text, <Ctrl+b>Add italic text, <Ctrl+i>
Add a quote, <Ctrl+Shift+.>Add code, <Ctrl+e>Add a link, <Ctrl+k>
Add a bulleted list, <Ctrl+Shift+8>Add a numbered list, <Ctrl+Shift+7>Add a task list, <Ctrl+Shift+l>
Directly mention a user or team
Reference an issue, pull request, or discussion
Add saved reply
Leave a comment
No file chosen
Attach files by dragging & dropping, selecting or pasting them.
Styling with Markdown is supported
Remember, contributions to this repository should follow its contributing guidelines, security policy, and code of conduct.
 ProTip! Add .patch or .diff to the end of URLs for Git’s plaintext views.
Reviewers
No reviews
Assignees
No one assigned
Labels
None yet
Projects
None yet
Milestone
No milestone
Development
Successfully merging this pull request may close these issues.

None yet

Notifications
Customize
You’re receiving notifications because you modified the open/close state.
1 participant
@zakwarlord7
Allow edits and access to secrets by maintainers
Footer
© 2023 GitHub, Inc.
Footer navigation
Terms
Privacy
Security
Status
Docs
Contact GitHub
Pricing
API
Training
Blog
About
on:
  push:
    branches: master
  pull_request: 
    run-on: ubuntu-latest
    steps:
    - name: Set up Git repository
      uses: actions/checkout@v3
    - name: Set up Ruby
      uses: ruby/setup-ruby@v1
      with:
        bundler-cache: true
    - name: Set up Node
      uses: actions/setup-node@v3
    - name: Bootstrap
      run: script/bootstrap
    - name: Tests
      run: script/test 
<?xml version="1.0" encoding="utf-8"?>
charmap keyset =  new
{ "new keymap Charset = Pro" }
<configuration>
    <packageSources>
        <clear />
        <add key="github" value="https://nuget.pkg.github.com/OWNER/index.json" />
    </packageSources>
    <packageSourceCredentials>
        <github>
            <add key="Username" value="USERNAME" />
            <add key="ClearTextPassword" value="TOKEN" />
        </github>
    </packageSourceCredentials>
</configuration> 
on:
Runs-on:on:"
const: "token"''
token: "((c)(r))"''
'Value": "[VOLUME]'"''
 '[VOLUME']": "[12753750.[00]m]BITORE_34173.1337_18893":,
 closed this
