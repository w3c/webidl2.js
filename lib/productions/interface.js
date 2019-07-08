import { Container } from "./container.js";
import { Attribute } from "./attribute.js";
import { Operation } from "./operation.js";
import { Constant } from "./constant.js";
import { IterableLike } from "./iterable.js";
import { stringifier } from "./helpers.js";

/**
 * @param {import("../tokeniser").Tokeniser} tokeniser
 */
function static_member(tokeniser) {
  const special = tokeniser.consume("static");
  if (!special) return;
  const member = Attribute.parse(tokeniser, { special }) ||
    Operation.parse(tokeniser, { special }) ||
    tokeniser.error("No body in static member");
  return member;
}

export class Interface extends Container {
  /**
   * @param {import("../tokeniser").Tokeniser} tokeniser
   */
  static parse(tokeniser, base, { partial = null } = {}) {
    const tokens = { partial, base };
    return Container.parse(tokeniser, new Interface({ source: tokeniser.source, tokens }), {
      type: "interface",
      inheritable: !partial,
      allowedMembers: [
        [Constant.parse],
        [static_member],
        [stringifier],
        [IterableLike.parse],
        [Attribute.parse],
        [Operation.parse]
      ]
    });
  }

  get type() {
    return "interface";
  }
}
