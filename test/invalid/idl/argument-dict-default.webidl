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
  void x(optional Dict dict);
  void x2(optional Dict dict = {});
  void y(optional (boolean or Dict) union);
  void y2(optional (boolean or Dict) union = {});
  void z(optional Union union);
  void z2(optional Union union = {});
  void r(Required req);
};
