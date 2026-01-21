import { ExtendedAttributes } from "./productions/extended-attributes.js";
import { Tokeniser } from "./tokeniser.js";

// Remove this once all of our support targets expose `.flat()` by default
function flatten(array) {
  if (array.flat) {
    return array.flat();
  }
  return [].concat(...array);
}

// https://heycam.github.io/webidl/#own-exposure-set
function getOwnExposureSet(node) {
  const exposedAttr = node.extAttrs.find((a) => a.name === "Exposed");
  if (!exposedAttr) {
    return null;
  }
  const exposure = new Set();
  const { type, value } = exposedAttr.rhs;
  if (type === "identifier") {
    exposure.add(value);
  } else if (type === "identifier-list") {
    for (const ident of value) {
      exposure.add(ident.value);
    }
  }
  return exposure;
}

/**
 * @param {Set?} a a Set or null
 * @param {Set?} b a Set or null
 * @return {Set?} a new intersected set, one of the original sets, or null
 */
function intersectNullable(a, b) {
  if (a && b) {
    const intersection = new Set();
    for (const v of a.values()) {
      if (b.has(v)) {
        intersection.add(v);
      }
    }
    return intersection;
  }
  return a || b;
}

/**
 * @param {Set?} a a Set or null
 * @param {Set?} b a Set or null
 * @return true if a and b have the same values, or both are null
 */
function equalsNullable(a, b) {
  if (a && b) {
    if (a.size !== b.size) {
      return false;
    }
    for (const v of a.values()) {
      if (!b.has(v)) {
        return false;
      }
    }
  }
  return a === b;
}

/**
 * @param {Container} target definition to copy members to
 * @param {Container} source definition to copy members from
 */
function copyMembers(target, source) {
  const targetExposure = getOwnExposureSet(target);
  const parentExposure = intersectNullable(
    targetExposure,
    getOwnExposureSet(source)
  );
  // TODO: extended attributes
  for (const orig of source.members) {
    const origExposure = getOwnExposureSet(orig);
    const copyExposure = intersectNullable(origExposure, parentExposure);

    // Make a copy of the member with the same prototype and own properties.
    const copy = Object.create(
      Object.getPrototypeOf(orig),
      Object.getOwnPropertyDescriptors(orig)
    );

    if (!equalsNullable(targetExposure, copyExposure)) {
      let value = Array.from(copyExposure.values()).join(",");
      if (copyExposure.size !== 1) {
        value = `(${value})`;
      }
      copy.extAttrs = ExtendedAttributes.parse(
        new Tokeniser(` [Exposed=${value}] `)
      );
    }

    target.members.push(copy);
  }
}

/**
 * @param {*[]} ast AST or array of ASTs
 * @return {*[]}
 */
export function merge(ast) {
  const dfns = new Map();
  const partials = [];
  const includes = [];

  for (const dfn of flatten(ast)) {
    if (dfn.partial) {
      partials.push(dfn);
    } else if (dfn.type === "includes") {
      includes.push(dfn);
    } else if (dfn.name) {
      dfns.set(dfn.name, dfn);
    } else {
      throw new Error(`definition with no name`);
    }
  }

  // merge partials (including partial mixins)
  for (const partial of partials) {
    const target = dfns.get(partial.name);
    if (!target) {
      throw new Error(
        `original definition of partial ${partial.type} ${partial.name} not found`
      );
    }
    if (partial.type !== target.type) {
      throw new Error(
        `partial ${partial.type} ${partial.name} inherits from ${target.type} ${target.name} (wrong type)`
      );
    }
    copyMembers(target, partial);
  }

  return Array.from(dfns.values());
}
