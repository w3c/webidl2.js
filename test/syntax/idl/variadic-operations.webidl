// Extracted from http://dev.w3.org/2006/webapi/WebIDL/ on 2011-05-06
interface IntegerSet {
  readonly attribute unsigned long cardinality;

  undefined union(long... ints);
  undefined intersection(long... ints);
};
