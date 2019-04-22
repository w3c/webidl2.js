export function unescape(identifier) {
  return identifier.startsWith('_') ? identifier.slice(1) : identifier;
}
