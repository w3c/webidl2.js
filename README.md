
Installation
============

Just the usual. For Node:

    npm install webidl2
    
In the browser:

    <script src='webidl2.js'></script>

Documentation
=============

The API to WebIDL2 is trivial: you parse a string of WebIDL and it returns a syntax tree.

Parsing
-------
In Node, that happens with:

    var WebIDL2 = require("webidl2");
    var tree = WebIDL2.parse("string of WebIDL");

In the browser:

    <script src='webidl2.js'></script>
    <script>
      var tree = WebIDL2.parse("string of WebIDL");
    </script>

Errors
------
When there is a syntax error in the WebIDL, it throws an exception object with the following
properties:

* `message`: the error message
* `line`: the line at which the error occurred.
* `input`: a short peek at the text at the point where the error happened
* `tokens`: the five tokens at the point of error, as understood by the tokeniser
  (this is the same content as `input`, but seen from the tokeniser's point of view)

The exception also has a `toString()` method that hopefully should produce a decent
error message.

Testing
=======

In order to run the tests you need to ensure that the widlproc submodule inside `test` is
initialised and up to date:

    git submodule init
    git submodule update
    git pull origin master (in the submodule, once in a while)

Running
-------
The test runs with mocha and expect.js. Normally, running mocha in the root directory
should be enough once you're set up.

Coverage
--------
Current test coverage, as documented in `coverage.html`, is 95%. You can run your own
coverage analysis with:

    jscoverage lib lib-cov
    
That will create the lib-cov directory with instrumented code; the test suite knows
to use that if needed. You can then run the tests with:

    JSCOV=1 mocha --reporter html-cov > coverage.html

Note that I've been getting weirdly overescaped results from the html-cov reporter,
so you might wish to try this instead:

    JSCOV=1 mocha  --reporter html-cov | sed "s/&lt;/</g" | sed "s/&gt;/>/g" | sed "s/&quot;/\"/g" > coverage.html

Browser tests
-------------
In order to test in the browser, get inside `test/web` and run `make-web-tests.js`. This
will generate a `browser-tests.html` file that you can open in a browser. As of this
writing tests pass in the latest Firefox, Chrome, Opera, and Safari. Testing on IE
and older versions will happen progressively.

TODO
====

* add some tests to address coverage limitations
* document
* review the test JSONs to for correctness
