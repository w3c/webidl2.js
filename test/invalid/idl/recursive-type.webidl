typedef (boolean or Recursive or Y) Recursive;

dictionary Y {};

[Exposed=Window]
interface X {
  void recursive(optional Recursive r);
};
