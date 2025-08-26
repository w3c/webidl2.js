/** @import {Token} from "../tokeniser.js" */

export class ArrayBase extends Array {
  /** @type {Record<string, Token | undefined>} */
  tokens;
  /** @type {Token[]} */
  source;
  parent;

  constructor({ source, tokens }) {
    super();
    Object.defineProperties(this, {
      source: { value: source },
      tokens: { value: tokens },
      parent: { value: null, writable: true },
    });
  }
}
