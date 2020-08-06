dictionary Dict {};

typedef (boolean or Dict) BooleanDict;
typedef (boolean or Dict)? NullableBooleanDict;
typedef (boolean or (short or Dict)) NestedBooleanDict;
typedef (boolean or (short or Dict))? NullableNestedBooleanDict;
typedef (boolean or (short or Dict)?) NestedNullableBooleanDict;
typedef BooleanDict? ReferencingNullableBooleanDict;
typedef (boolean or RecursiveBooleanDict? or Dict) RecursiveBooleanDict;

// Safe to have this, because Dict? is not a dictionary type but a nullable type,
// with its inner type being a dictionary.
// See: https://heycam.github.io/webidl/#idl-nullable-type
typedef (boolean or Dict?)? NullableBooleanNullableDict;

callback Callback = (boolean or Dict)? ();
[Exposed=Window]
interface Interface {
  (boolean or Dict)? op();
  undefined voidOp((boolean or Dict)? arg);
  attribute (boolean or Dict)? attr;

  iterable<(boolean or Dict)?>;
};

dictionary AnotherDict {
  (boolean or Dict)? dict;
};
