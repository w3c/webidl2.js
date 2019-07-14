typedef (boolean or Recursive or Y) Recursive;
typedef (boolean or FriendY) FriendX;
typedef (boolean or FriendX or Y) FriendY;

dictionary Y {};

[Exposed=Window]
interface X {
  void recursive(optional Recursive r);
  void recursive2(optional FriendX f);
};
