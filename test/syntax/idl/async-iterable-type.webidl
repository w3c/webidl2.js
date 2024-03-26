interface Canvas {
  Promise<undefined> drawPolygonAsync(async iterable<float> coordinates);
};

interface I {
  Promise<undefined> f1(async iterable<[XAttr] float> arg);
};

[Exposed=Window]
interface asyncIterableReturn {
  async iterable<short> stream(async iterable<short> foo);
};
