/** @import { Base } from "./productions/base.js" */
/** @import { Token } from "./tokeniser.js" */

/**
 * @template T
 * @param {T} arg
 */
function noop(arg) {
  return arg;
}

/**
 * @typedef {object} TemplateContext
 * @property {Base} data
 * @property {Base} parent
 */

/**
 * @template T
 * @typedef {object} WriteTemplates
 * @property {(items: (T | string)[]) => T} wrap
 * @property {(trivia: string) => T} trivia
 * @property {(escaped: string, context: TemplateContext) => T} name
 * @property {(escaped: string, unescaped: string, context: Base) => T} reference
 * @property {(type: T) => T} type
 * @property {(name: string) => T} generic
 * @property {(keyword: string, context: TemplateContext) => T} nameless
 * @property {(inheritable: T) => T} inheritance
 * @property {(content: T, context: TemplateContext) => T} definition
 * @property {(content: T) => T} extendedAttribute
 * @property {(content: string) => T} extendedAttributeReference
 */

/** @type {WriteTemplates<string>} */
const templates = {
  /** @type {(items: any[]) => string} */
  wrap: (items) => items.join(""),
  trivia: noop,
  name: noop,
  reference: noop,
  type: noop,
  generic: noop,
  nameless: noop,
  inheritance: noop,
  definition: noop,
  extendedAttribute: noop,
  extendedAttributeReference: noop,
};

/** @template T */
export class Writer {
  /** @type {WriteTemplates<T>} */
  ts;

  /**
   * @param {WriteTemplates<T>} ts
   */
  constructor(ts) {
    this.ts = Object.assign({}, templates, ts);
  }

  /**
   * @param {string} raw
   * @param {object} options
   * @param {string} [options.unescaped]
   * @param {Base} [options.context]
   */
  reference(raw, { unescaped, context }) {
    if (!unescaped) {
      unescaped = raw.startsWith("_") ? raw.slice(1) : raw;
    }
    return this.ts.reference(raw, unescaped, context);
  }

  /**
   * @overload
   * @param {Token} t
   * @param {(tokenValue: string, options: { context: Base }) => T | string} wrapper
   * @param {object} options
   * @param {Base} options.context
   * @returns {T | string}
   */
  /**
   * @overload
   * @param {Token} t
   * @param {(tokenValue: string, context: TemplateContext) => T | string} [wrapper]
   * @param {TemplateContext} [context]
   * @returns {T | string}
   */
  /**
   * @param {Token} t
   * @param {(tokenValue: string, context: any) => T | string} [wrapper]
   * @param {any} [context]
   */
  token(t, wrapper = noop, context) {
    if (!t) {
      return "";
    }
    const value = wrapper(t.value, context);
    return this.ts.wrap([this.ts.trivia(t.trivia), value]);
  }

  reference_token(t, context) {
    return this.token(t, this.reference.bind(this), { context });
  }

  name_token(t, arg) {
    return this.token(t, this.ts.name, arg);
  }

  identifier(id, context) {
    return this.ts.wrap([
      this.reference_token(id.tokens.value, context),
      this.token(id.tokens.separator),
    ]);
  }
}

/**
 * @overload
 * @param {Base[]} ast
 * @returns {string}
 */
/**
 * @template T
 * @overload
 * @param {Base[]} ast
 * @param {object} options
 * @param {WriteTemplates<T>} [options.templates]
 * @returns {T}
 */
/**
 * @param {Base[]} ast
 * @param {object} options
 * @param {WriteTemplates<unknown>} [options.templates]
 * @returns {unknown}
 */
export function write(ast, { templates: ts = templates } = {}) {
  ts = Object.assign({}, templates, ts);

  /** @type {Writer<unknown>} */
  const w = new Writer(ts);

  return ts.wrap(ast.map((it) => it.write(w)));
}
