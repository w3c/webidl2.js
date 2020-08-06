typedef (boolean or Recursive or Y) Recursive;
typedef (boolean or FriendY) FriendX;
typedef (boolean or FriendX or Y) FriendY;

dictionary Y {};

[Exposed=Window]
interface X {
  undefined recursive(optional Recursive r);
  undefined recursive2(optional FriendX f);
};
