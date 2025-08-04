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
      source: { value: source, enumerable: false },
      tokens: { value: tokens, writable: true, enumerable: false },
      parent: { value: null, writable: true, enumerable: false },
      this: { value: this, enumerable: false }, // useful when escaping from proxy
    });
  }

  get type() { return undefined; };
  get name() { return undefined; };

  /**
   * @param {Definitions} defs
   * @returns {IterableIterator<any>}
   */
  // eslint-disable-next-line no-unused-vars
  *validate(defs) {}

  /**
   * @template T
   * @param {Writer<T>} w
   * @returns {T | string}
   */
  // eslint-disable-next-line no-unused-vars
  write(w) { return "" }

  toJSON() {
    const json = { type: undefined, name: undefined, inheritance: undefined };
    let proto = this;
    while (proto !== Object.prototype) {
      const descMap = Object.getOwnPropertyDescriptors(proto);
      for (const [key, value] of Object.entries(descMap)) {
        if (value.enumerable || value.get) {
          json[key] = this[key];
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
    return json;
  }
}
