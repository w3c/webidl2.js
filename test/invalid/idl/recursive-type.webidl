typedef (boolean or Y or Recursive) Recursive;

dictionary Y {};

[Exposed=Window]
interface X {
  void recursive(optional Recursive r);
};
