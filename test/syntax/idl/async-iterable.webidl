interface AsyncIterable {
  async_iterable<long, float>;
};

interface AsyncIterableWithExtAttr {
  async_iterable<[XAttr2] DOMString, [XAttr3] long>;
};

interface AsyncIterableWithNoParam {
  async_iterable<float, ByteString>();
};

interface AsyncIterableWithParam {
  async_iterable<float, ByteString>(USVString str);
};

interface AsyncValueIterable {
  async_iterable<float>;
};

interface AsyncValueIterableWithNoParam {
  async_iterable<float>();
};

interface AsyncValueIterableWithParams {
  async_iterable<float>(DOMString str, short s);
};
