
Installation
============

Just the usual:

    npm install webidl2

Testing
=======

In order to run the tests you need to ensure that the widlproc submodule inside `test` is
initialised and up to date:

    git submodule init
    git submodule update
    git pull origin master (in the submodule, once in a while)

The test runs with mocha and expect.js. Normally, running mocha in the root directory
should be enough once you're set up.

Current test coverage, as documented in `coverage.html`, is 95%. You can run your own
coverage analysis with:

    jscoverage lib lib-cov
    
That will create the lib-cov directory with instrumented code; the test suite knows
to use that if needed. You can then run the tests with:

    JSCOV=1 mocha --reporter html-cov > coverage.html

Note that I've been getting weirdly overescaped results from the html-cov reporter,
so you might wish to try this instead:

    JSCOV=1 mocha  --reporter html-cov | sed "s/&lt;/</g" | sed "s/&gt;/>/g" | sed "s/&quot;/\"/g" > coverage.html


TODO
====

* add some tests to address coverage limitations
* test in browser
* document
* review the test JSONs to for correctness
