// Extracted from http://dev.w3.org/2006/webapi/WebIDL/ on 2011-05-06
interface OrderedMap {
  readonly attribute unsigned long size;

  getter any getByIndex(unsigned long index);
  setter undefined setByIndex(unsigned long index, any value);
  deleter undefined removeByIndex(unsigned long index);

  getter any get(DOMString name);
  setter undefined set(DOMString name, any value);
  deleter undefined remove(DOMString name);
};
