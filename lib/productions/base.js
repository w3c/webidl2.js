/** @import {ExtendedAttributes} from "./extended-attributes.js" */
/** @import {Token} from "../tokeniser.js" */
/** @import {Definitions} from "../validator.js" */
/** @import {Writer} from "../writer.js" */

export class Base {
  /** @type {Record<string, Token | undefined>} */
  tokens;
  /** @type {Token[]} */
  source;
  /** @type {ExtendedAttributes | undefined} */
  extAttrs;
  /** @type {this} */
  this;
  /** @type {*} */
  parent;

  /**
   * @param {object} initializer
   * @param {Base["source"]} initializer.source
   * @param {Base["tokens"]} initializer.tokens
   */
  constructor({ source, tokens }) {
    Object.defineProperties(this, {
      source: { value: source },
      tokens: { value: tokens, writable: true },
      parent: { value: null, writable: true },
      this: { value: this }, // useful when escaping from proxy
    });
  }

  /**
   * @param {Definitions} defs
   * @returns {IterableIterator<any>}
   */
  // eslint-disable-next-line no-unused-vars
  *validate(defs) {}

  /**
   * @param {Writer} w
   * @returns {*}
   */
  // eslint-disable-next-line no-unused-vars
  write(w) {}

  toJSON() {
    const json = { type: undefined, name: undefined, inheritance: undefined };
    let proto = this;
    while (proto !== Object.prototype) {
      const descMap = Object.getOwnPropertyDescriptors(proto);
      for (const [key, value] of Object.entries(descMap)) {
        if (value.enumerable || value.get) {
          // @ts-ignore - allow indexing here
          json[key] = this[key];
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
    return json;
  }
}
