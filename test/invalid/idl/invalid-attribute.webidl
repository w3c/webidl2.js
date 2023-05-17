[Exposed=Window]
interface sequenceAsAttribute {
  attribute sequence<short> invalid;
  attribute (sequence<short> or boolean) invalidUnion; // TODO
};

[Exposed=Window]
interface recordAsAttribute {
  attribute record<DOMString, DOMString> invalid;
  attribute (record<DOMString, DOMString> or boolean) invalidUnion; // TODO
};

dictionary Dict {};

[Exposed=Window]
interface dictionaryAsAttribute {
  attribute Dict dict;
  attribute (Dict or boolean) dictUnion;
};

typedef [EnforceRange] long GPUInt32;
typedef long GPUInt32In;

[Exposed=Window]
interface EnforceRangeInReadonlyAttribute {
  attribute [EnforceRange] long noProblem;

  readonly attribute [EnforceRange] long readOnlyAttr1;
  readonly attribute [EnforceRange] GPUInt32In readOnlyAttr2;
  readonly attribute GPUInt32 readOnlyAttr2;
};
