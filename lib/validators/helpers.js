export function idlTypeIncludesDictionary(idlType, defs) {
  if (!idlType.union) {
    const def = defs.unique.get(idlType.idlType);
    if (!def) {
      return false;
    }
    if (def.type === "typedef") {
      return idlTypeIncludesDictionary(def.idlType, defs);
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
