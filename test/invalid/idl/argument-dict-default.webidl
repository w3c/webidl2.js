dictionary Dict {
  short x = 0;
};

dictionary Required {
  required short x;
};

typedef (short or Dict) Union;

[Exposed=Window]
interface X {
  constructor(optional Union union);
  undefined x(optional Dict dict);
  undefined x2(optional Dict dict = {});
  undefined y(optional (boolean or Dict) union);
  undefined y2(optional (boolean or Dict) union = {});
  undefined z(optional Union union);
  undefined z2(optional Union union = {});
  undefined r(Required req);

  async iterable<DOMString>(optional Union union);
};
