function noop(arg) {
  return arg;
}

const templates = {
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

export class Writer {
  constructor(ts) {
    this.ts = Object.assign({}, templates, ts);
  }

  reference(raw, { unescaped, context }) {
    if (!unescaped) {
      unescaped = raw.startsWith("_") ? raw.slice(1) : raw;
    }
    return this.ts.reference(raw, unescaped, context);
  }

  token(t, wrapper = noop, ...args) {
    if (!t) {
      return "";
    }
    const value = wrapper(t.value, ...args);
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

export function write(ast, { templates: ts = templates } = {}) {
  ts = Object.assign({}, templates, ts);

  const w = new Writer(ts);

  function reference(raw, { unescaped, context }) {
    if (!unescaped) {
      unescaped = raw.startsWith("_") ? raw.slice(1) : raw;
    }
    return ts.reference(raw, unescaped, context);
  }

  function token(t, wrapper = noop, ...args) {
    if (!t) {
      return "";
    }
    const value = wrapper(t.value, ...args);
    return ts.wrap([ts.trivia(t.trivia), value]);
  }

  function reference_token(t, context) {
    return token(t, reference, { context });
  }

  function name_token(t, arg) {
    return token(t, ts.name, arg);
  }

  function inheritance(inh) {
    if (!inh.tokens.inheritance) {
      return "";
    }
    return ts.wrap([
      token(inh.tokens.colon),
      ts.trivia(inh.tokens.inheritance.trivia),
      ts.inheritance(reference(inh.tokens.inheritance.value, { context: inh })),
    ]);
  }

  function container(it) {
    return ts.definition(
      ts.wrap([
        it.extAttrs.write(w),
        token(it.tokens.callback),
        token(it.tokens.partial),
        token(it.tokens.base),
        token(it.tokens.mixin),
        name_token(it.tokens.name, { data: it }),
        inheritance(it),
        token(it.tokens.open),
        iterate(it.members, it),
        token(it.tokens.close),
        token(it.tokens.termination),
      ]),
      { data: it }
    );
  }

  function typedef(it) {
    return ts.definition(
      ts.wrap([
        it.extAttrs.write(w),
        token(it.tokens.base),
        ts.type(it.idlType.write(w)),
        name_token(it.tokens.name, { data: it }),
        token(it.tokens.termination),
      ]),
      { data: it }
    );
  }
  function includes(it) {
    return ts.definition(
      ts.wrap([
        it.extAttrs.write(w),
        reference_token(it.tokens.target, it),
        token(it.tokens.includes),
        reference_token(it.tokens.mixin, it),
        token(it.tokens.termination),
      ]),
      { data: it }
    );
  }
  function callback(it) {
    return ts.definition(
      ts.wrap([
        it.extAttrs.write(w),
        token(it.tokens.base),
        name_token(it.tokens.name, { data: it }),
        token(it.tokens.assign),
        ts.type(it.idlType.write(w)),
        token(it.tokens.open),
        ...it.arguments.map((arg) => arg.write(w)),
        token(it.tokens.close),
        token(it.tokens.termination),
      ]),
      { data: it }
    );
  }
  function enum_(it) {
    return ts.definition(
      ts.wrap([
        it.extAttrs.write(w),
        token(it.tokens.base),
        name_token(it.tokens.name, { data: it }),
        token(it.tokens.open),
        iterate(it.values, it),
        token(it.tokens.close),
        token(it.tokens.termination),
      ]),
      { data: it }
    );
  }
  function enum_value(v, parent) {
    return ts.wrap([
      ts.trivia(v.tokens.value.trivia),
      ts.definition(
        ts.wrap(['"', ts.name(v.value, { data: v, parent }), '"']),
        { data: v, parent }
      ),
      token(v.tokens.separator),
    ]);
  }
  function eof(it) {
    return ts.trivia(it.trivia);
  }

  const table = {
    interface: container,
    "interface mixin": container,
    namespace: container,
    dictionary: container,
    typedef,
    includes,
    callback,
    enum: enum_,
    "enum-value": enum_value,
    "callback interface": container,
    eof,
  };
  function dispatch(it, parent) {
    if (it.write) {
      return it.write(w);
    }
    const dispatcher = table[it.type];
    if (!dispatcher) {
      throw new Error(`Type "${it.type}" is unsupported`);
    }
    return table[it.type](it, parent);
  }
  function iterate(things, parent) {
    if (!things) return;
    const results = things.map((thing) => dispatch(thing, parent));
    return ts.wrap(results);
  }
  return iterate(ast);
}
