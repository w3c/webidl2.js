// Extracted from http://dev.w3.org/2006/webapi/WebIDL/ on 2011-05-06
interface Circle {
  constructor();
  constructor(float radius);
  constructor(optional string str = "");
  constructor(sequence<string> seq);
  constructor((Type1 or Type2) union);
  attribute float r;
  attribute float cx;
  attribute float cy;
  readonly attribute float circumference;
};
