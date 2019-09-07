import { Container } from "./container.js";
import { Attribute } from "./attribute.js";
import { Operation } from "./operation.js";
import { Constant } from "./constant.js";
import { IterableLike } from "./iterable.js";
import { stringifier, autofixAddExposedWindow } from "./helpers.js";
import { validationError } from "../error.js";
import { checkInterfaceMemberDuplication } from "../validators/interface.js";
import { Constructor } from "./constructor.js";
import { Tokeniser } from "../tokeniser.js";

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
        [Constructor.parse],
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

  *validate(defs) {
    yield* this.extAttrs.validate(defs);
    if (
      !this.partial &&
      this.extAttrs.every(extAttr => extAttr.name !== "Exposed") &&
      this.extAttrs.every(extAttr => extAttr.name !== "NoInterfaceObject")
    ) {
      const message = `Interfaces must have \`[Exposed]\` extended attribute. \
To fix, add, for example, \`[Exposed=Window]\`. Please also consider carefully \
if your interface should also be exposed in a Worker scope. Refer to the \
[WebIDL spec section on Exposed](https://heycam.github.io/webidl/#Exposed) \
for more information.`;
      yield validationError(this.tokens.name, this, message, {
        autofix: autofixAddExposedWindow(this)
      });
    }
    const constructors = this.extAttrs.filter(extAttr => extAttr.name === "Constructor");
    for (const constructor of constructors) {
      const message = `Constructors should now be represented as constructor operations \
instead of \`[Constructor]\`. Refer to the \
[WebIDL spec section on constructor operations](https://heycam.github.io/webidl/#idl-constructors) \
for more information.`;
      yield validationError(constructor.tokens.name, this, message, {
        autofix: autofixConstructor(this, constructor)
      });
    }

    yield* super.validate(defs);
    if (!this.partial) {
      yield* checkInterfaceMemberDuplication(defs, this);
    }
  }
}

function autofixConstructor(interfaceDef, constructorExtAttr) {
  return () => {
    const constructorOp = Constructor.parse(new Tokeniser("\nconstructor();"));
    constructorOp.extAttrs = [];
    constructorOp.arguments = constructorExtAttr.arguments;
    interfaceDef.members.push(constructorOp);
    const { extAttrs } = interfaceDef;
    const index = extAttrs.indexOf(constructorExtAttr);
    extAttrs.splice(index, 1);
    if (!extAttrs.length) {
      extAttrs.tokens.open = extAttrs.tokens.close = undefined;
    } else if (extAttrs.length === index) {
      extAttrs[index - 1].tokens.separator = undefined;
    }
  };
}
