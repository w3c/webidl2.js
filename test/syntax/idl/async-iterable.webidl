interface AsyncIterable {
  async iterable<long, float>;
};

interface AsyncIterableWithExtAttr {
  async iterable<[XAttr2] DOMString, [XAttr3] long>;
};

interface AsyncValueIterable {
  async iterable<float>;
};
