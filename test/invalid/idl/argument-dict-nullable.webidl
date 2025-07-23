dictionary Dict {
  short x = 0;
};

dictionary Required {
  required short x;
};

typedef (short or Dict) Union;

[Exposed=Window]
interface X {
  undefined x1(optional Dict? dict);
  undefined x2(optional Dict? dict = {});
  undefined y2(optional (boolean or Dict)? union = {});
  undefined z2(optional Union? union = {});
  undefined r(Required? req);

  async_iterable<DOMString>(optional Dict? dict);
};
