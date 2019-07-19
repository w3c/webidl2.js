dictionary Dict {};

typedef (boolean or Dict) BooleanDict;
typedef (boolean or Dict)? NullableBooleanDict;
typedef (boolean or (short or Dict)) NestedBooleanDict;
typedef (boolean or (short or Dict))? NullableNestedBooleanDict;
typedef (boolean or (short or Dict)?) NestedNullableBooleanDict;
typedef BooleanDict? ReferencingNullableBooleanDict;
typedef (boolean or RecursiveBooleanDict? or Dict) RecursiveBooleanDict;

callback Callback = (boolean or Dict)? ();
[Exposed=Window]
interface Interface {
  (boolean or Dict)? op();
  void voidOp((boolean or Dict)? arg);
  attribute (boolean or Dict)? attr;
};

dictionary AnotherDict {
  (boolean or Dict)? dict;
};
