[Exposed=Window]
interface Interface {
  attribute bigint _bigint;
  bigint getBig();
  void setBig(bigint big);
};

dictionary Dictionary {
  bigint big;
  required bigint another;
};

typedef (bigint or short) allowed;
