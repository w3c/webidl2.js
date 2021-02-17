dictionary Optional {
  short field;
};

dictionary Required {
  required short field;
};

dictionary Required2: Required {
  long field2;
};

// The following is wrong
// but it still shouldn't break the validator
dictionary Recursive : Recursive2 {};
dictionary Recursive2 : Recursive {};

// Do not warn if we don't know about the supertype
dictionary SuperDictUnknown: GuessWhatAmI {};

typedef (DOMString or Optional) OptionalUnion;
typedef (DOMString or Optional?) NullableUnion;

interface mixin Container {
  undefined op1(Optional shouldBeOptional);
  undefined op2(Required noNeedToBeOptional);
  undefined op22(Required2 noNeedToBeOptional);
  // The same again to expose caching bug:
  undefined op23(Required2 noNeedToBeOptional);

  undefined op3((Optional or boolean) union);
  undefined op4(OptionalUnion union);
  undefined op5(NullableUnion union);

  undefined op6(Recursive recursive);
  undefined op7(SuperDictUnknown unknown);

  undefined op8(Optional lastRequired, optional DOMString yay);
  undefined op9(Optional notLast, DOMString yay);
};

[Exposed=Window]
interface ContainerInterface {
  async iterable<DOMString>(Optional shouldBeOptional);
};
