interface AsyncIterable {
  async iterable<long, float>;
};

interface AsyncIterableWithExtAttr {
  async iterable<[XAttr2] DOMString, [XAttr3] long>;
};

interface AsyncIterableWithNoParam {
  async iterable<float, ByteString>();
};

interface AsyncIterableWithParam {
  async iterable<float, ByteString>(USVString str);
};

interface AsyncValueIterable {
  async iterable<float>;
};

interface AsyncValueIterableWithNoParam {
  async iterable<float>();
};

interface AsyncValueIterableWithParams {
  async iterable<float>(DOMString str, short s);
};
