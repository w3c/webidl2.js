callback AsyncOperationCallback = undefined (DOMString status);

callback interface EventHandler {
  undefined eventOccurred(DOMString details);
};

callback SortCallback = boolean (any a, any b);
