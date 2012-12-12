
Installation
============

Just the usual:

    npm install webidl2

Testing
=======

In order to run the tests you need to ensure that the widlproc submodule inside `test` is
initialised and up to date:

    git submodule init
    # or
    git submodule update


TODO
====

* remove old tests and replace them with https://github.com/dontcallmedom/widlproc/blob/master/test
* convert the XML from widlproc into JSON ASTs for testing
* run coverage to see if there's any glaring omission in the tests
* test in browser
* document
* test invalid WebIDL too

