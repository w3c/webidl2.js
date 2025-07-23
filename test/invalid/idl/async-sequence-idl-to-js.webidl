[Exposed=Window]
interface asyncIterableAsAttribute {
  attribute async_sequence<short> invalid;
  attribute (async_sequence<short> or boolean) invalidUnion; // TODO
  async_sequence<DOMString> invalidOp();
};

callback DoSomething = Promise<DOMString> (async_sequence<DOMString> bool);

