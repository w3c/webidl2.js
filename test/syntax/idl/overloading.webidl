// Extracted from http://dev.w3.org/2006/webapi/WebIDL/ on 2011-05-06
interface A {
  // ...
};

interface B {
  // ...
};

interface C {
  undefined f(A x);
  undefined f(B x);
};

interface D {
  /* f1 */ undefined f(DOMString a);
  /* f2 */ undefined f([AllowAny] DOMString a, DOMString b, float... c);
  /* f3 */ undefined f();
  /* f4 */ undefined f(long a, DOMString b, optional DOMString c, float... d);
};
