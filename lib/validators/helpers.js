export function idlTypeIncludesDictionary(idlType, defs) {
  if (!idlType.union) {
    const def = defs.unique.get(idlType.idlType);
    if (!def) {
      return false;
    }
    if (def.type === "typedef") {
      const cached = defs.cache.typedefIncludesDictionary.get(def);
      if (cached === null) {
        return false; // null means indeterminate, return false for now
      }
      defs.cache.typedefIncludesDictionary.set(def, null); // indeterminate state
      const result = idlTypeIncludesDictionary(def.idlType, defs);
      defs.cache.typedefIncludesDictionary.set(def, result);
      return result;
    }
    return def.type === "dictionary";
  }
  for (const subtype of idlType.subtype) {
    if (idlTypeIncludesDictionary(subtype, defs)) {
      return true;
    }
  }
  return false;
}
