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
  void op1(Optional shouldBeOptional);
  void op2(Required noNeedToBeOptional);
  void op22(Required2 noNeedToBeOptional);

  void op3((Optional or boolean) union);
  void op4(OptionalUnion union);
  void op5(NullableUnion union);

  void op6(Recursive recursive);
  void op7(SuperDictUnknown unknown);

  void op8(Optional lastRequired, optional DOMString yay);
  void op9(Optional notLast, DOMString yay);
};
