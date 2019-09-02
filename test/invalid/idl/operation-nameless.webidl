[Exposed=Window]
interface Anonymity {
  copy();
  static create();
  getter DOMString ();
  setter DOMString ();
  stringifier DOMString ();
  stringifier;
};
