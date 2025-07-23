interface Canvas {
  Promise<undefined> drawPolygonAsync(async_sequence<float> coordinates);
};

interface I {
  Promise<undefined> f1(async_sequence<[XAttr] float> arg);
};

[Exposed=Window]
interface asyncIterableReturn {
  async_sequence<short> stream(async_sequence<short> foo);
};
