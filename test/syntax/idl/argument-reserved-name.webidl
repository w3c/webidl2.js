[Exposed=Window]
interface Foo {
  undefined foo(unsigned long toString);
  undefined bar(DOMString _toString);
};

callback CallbackWithReservedArgumentName = undefined (short _constructor);
