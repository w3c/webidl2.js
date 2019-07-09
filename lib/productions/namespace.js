import { Container } from "./container.js";
import { Attribute } from "./attribute.js";
import { Operation } from "./operation.js";
import { validationError } from "../error.js";

export class Namespace extends Container {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser, { partial } = {}) {
    const tokens = { partial };
    tokens.base = tokeniser.consume("namespace");
    if (!tokens.base) {
      return;
    }
    return Container.parse(tokeniser, new Namespace({ source: tokeniser.source, tokens }), {
      type: "namespace",
      allowedMembers: [
        [Attribute.parse, { noInherit: true, readonly: true }],
        [Operation.parse, { regular: true }]
      ]
    });
  }

  get type() {
    return "namespace";
  }

  *validate(defs) {
    if (!this.partial && this.extAttrs.every(extAttr => extAttr.name !== "Exposed")) {
      const message = `Non-partial namespaces must have [Exposed] extended attribute.`;
      yield validationError(this.source, this.tokens.name, this, message);
    }
    yield* super.validate(defs);
  }
}
