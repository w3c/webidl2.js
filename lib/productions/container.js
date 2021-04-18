import { Base } from "./base.js";
import { ExtendedAttributes } from "./extended-attributes.js";
import { unescape, autoParenter } from "./helpers.js";

/**
 * @param {import("../tokeniser.js").Tokeniser} tokeniser
 */
function inheritance(tokeniser) {
  const colon = tokeniser.consume(":");
  if (!colon) {
    return {};
  }
  const inheritance =
    tokeniser.consume("identifier") ||
    tokeniser.error("Inheritance lacks a type");
  return { colon, inheritance };
}

export class Container extends Base {
  /**
   * @template T
   * @param {import("../tokeniser.js").Tokeniser} tokeniser
   * @param {T} instance
   * @param {*} args
   */
  static parse(tokeniser, instance, { type, inheritable, allowedMembers }) {
    const { tokens } = instance;
    tokens.name =
      tokeniser.consume("identifier") ||
      tokeniser.error(`Missing name in ${instance.type}`);
    tokeniser.current = instance;
    instance = autoParenter(instance);
    if (inheritable) {
      Object.assign(tokens, inheritance(tokeniser));
    }
    tokens.open = tokeniser.consume("{") || tokeniser.error(`Bodyless ${type}`);
    instance.members = [];
    while (true) {
      tokens.close = tokeniser.consume("}");
      if (tokens.close) {
        tokens.termination =
          tokeniser.consume(";") ||
          tokeniser.error(`Missing semicolon after ${type}`);
        return instance.this;
      }
      const ea = ExtendedAttributes.parse(tokeniser);
      let mem;
      for (const [parser, ...args] of allowedMembers) {
        mem = autoParenter(parser(tokeniser, ...args));
        if (mem) {
          break;
        }
      }
      if (!mem) {
        tokeniser.error("Unknown member");
      }
      mem.extAttrs = ea;
      instance.members.push(mem.this);
    }
  }

  get partial() {
    return !!this.tokens.partial;
  }
  get name() {
    return unescape(this.tokens.name.value);
  }
  get inheritance() {
    if (!this.tokens.inheritance) {
      return null;
    }
    return unescape(this.tokens.inheritance.value);
  }

  *validate(defs) {
    for (const member of this.members) {
      if (member.validate) {
        yield* member.validate(defs);
      }
    }
  }

  /** @param {import("../writer.js").Writer} w */
  write(w) {
    function inheritance(inh) {
      if (!inh.tokens.inheritance) {
        return "";
      }
      return w.ts.wrap([
        w.token(inh.tokens.colon),
        w.ts.trivia(inh.tokens.inheritance.trivia),
        w.ts.inheritance(
          w.reference(inh.tokens.inheritance.value, { context: inh })
        ),
      ]);
    }

    return w.ts.definition(
      w.ts.wrap([
        this.extAttrs.write(w),
        w.token(this.tokens.callback),
        w.token(this.tokens.partial),
        w.token(this.tokens.base),
        w.token(this.tokens.mixin),
        w.name_token(this.tokens.name, { data: this }),
        inheritance(this),
        w.token(this.tokens.open),
        w.ts.wrap(this.members.map((m) => m.write(w))),
        w.token(this.tokens.close),
        w.token(this.tokens.termination),
      ]),
      { data: this }
    );
  }
}
