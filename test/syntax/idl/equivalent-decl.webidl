// Extracted from http://dev.w3.org/2006/webapi/WebIDL/ on 2011-05-06
interface Dictionary {
  readonly attribute unsigned long propertyCount;

  getter float getProperty(DOMString propertyName);
  setter undefined setProperty(DOMString propertyName, float propertyValue);
};


interface Dictionary2 {
  readonly attribute unsigned long propertyCount;

  float getProperty(DOMString propertyName);
  undefined setProperty(DOMString propertyName, float propertyValue);

  getter float (DOMString propertyName);
  setter undefined (DOMString propertyName, float propertyValue);
};
