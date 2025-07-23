interface Canvas {
  Promise<undefined> drawPolygonAsync(async_sequence<float> coordinates);
};

interface I {
  Promise<undefined> f1(async_sequence<[XAttr] float> arg);
};
