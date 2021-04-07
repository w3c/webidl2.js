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
