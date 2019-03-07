"use strict";

(() => {
  function noop(arg) {
    return arg;
  }

  const templates = {
    wrap: items => items.join(""),
    trivia: noop,
    name: noop,
    reference: noop,
    type: noop,
    valueLiteral: noop,
    inheritance: noop,
    definition: noop,
    extendedAttribute: noop,
    extendedAttributeReference: noop
  };

  function write(ast, { templates: ts = templates } = {}) {
    ts = Object.assign({}, templates, ts);

    /**
     * @param {string[]} strings
     * @param  {...any} args
     */
    function wrap(strings, ...args) {
      return ts.wrap([].concat(...strings.map((s, i) => [s, args[i] || ""])));
    }

    function reference(raw, unescaped) {
      return ts.reference(raw, unescaped || raw);
    }

    function extract_trivia(object) {
      const batch = {};
      for (const key in object.trivia) {
        batch[key] = ts.trivia(object.trivia[key]);
      }
      return batch;
    }

    function token(t, value) {
      return t ? wrap`${ts.trivia(t.trivia)}${value || t.value}` : "";
    }

    function reference_token(t, unescaped) {
      return t ? wrap`${ts.trivia(t.trivia)}${reference(t.value, unescaped)}` : "";
    }

    function name_token(t, arg) {
      return t ? wrap`${ts.trivia(t.trivia)}${ts.name(t.value, arg)}` : "";
    }

    function type_body(it) {
      const trivia = extract_trivia(it);
      if (it.union) {
        const subtypes = ts.wrap(it.idlType.map(type));
        return wrap`${trivia.open}(${subtypes}${trivia.close})`;
      } else if (it.generic) {
        const genericName = wrap`${trivia.base}${reference(it.generic.value)}`;
        const subtypes = ts.wrap(it.idlType.map(type));
        const gTrivia = extract_trivia(it.generic);
        return wrap`${genericName}${gTrivia.open}<${subtypes}${gTrivia.close}>`;
      }
      if (!it.prefix && !it.postfix) {
        return wrap`${trivia.base}${reference(it.escapedBaseName, it.baseName)}`;
      }
      const precedingTrivia = it.prefix ? ts.trivia(it.prefix.trivia) : trivia.base;
      const prefix = it.prefix ? wrap`${it.prefix.value}${trivia.base}` : "";
      const ref = reference(wrap`${prefix}${it.baseName}${token(it.postfix)}`, it.idlType);
      return wrap`${precedingTrivia}${ref}`;
    }
    function type(it) {
      const ext = extended_attributes(it.extAttrs);
      const body = type_body(it);
      const nullable = token(it.nullable, "?");
      const separator = token(it.separator);
      return wrap`${ext}${body}${nullable}${separator}`;
    }
    function const_value(it) {
      const tp = it.type;
      if (tp === "boolean") return it.value ? "true" : "false";
      else if (tp === "null") return "null";
      else if (tp === "Infinity") return (it.negative ? "-" : "") + "Infinity";
      else if (tp === "NaN") return "NaN";
      else if (tp === "number") return it.value;
      else return `"${it.value}"`;
    }
    function default_(def, parent) {
      if (!def) {
        return "";
      }
      const trivia = extract_trivia(def);
      const assign = wrap`${trivia.assign}=`;
      if (def.type === "sequence") {
        return wrap`${assign}${trivia.open}[${trivia.close}]`;
      }
      return wrap`${assign}${trivia.value}${ts.valueLiteral(const_value(def), parent)}`;
    }
    function argument(arg) {
      const ext = extended_attributes(arg.extAttrs);
      const optional = token(arg.optional, "optional");
      const typePart = ts.type(type(arg.idlType));
      const variadic = token(arg.variadic, "...");
      const name = wrap`${ts.trivia(arg.trivia.name)}${ts.name(arg.escapedName, { data: arg })}`;
      const defaultValue = default_(arg.default, arg);
      const separator = token(arg.separator);
      return wrap`${ext}${optional}${typePart}${variadic}${name}${defaultValue}${separator}`;
    }
    function identifier(id) {
      return wrap`${ts.trivia(id.trivia)}${reference(id.value)}${token(id.separator)}`;
    }
    function make_ext_at(it) {
      const name = ts.extendedAttributeReference(it.name);
      let rhs = "";
      if (it.rhs) {
        const trivia = extract_trivia(it.rhs);
        rhs = (it.rhs.type === "identifier-list") ?
          wrap`${trivia.assign}=${trivia.open}(${ts.wrap(it.rhs.value.map(identifier))}${trivia.close})` :
          wrap`${trivia.assign}=${trivia.value}${reference(it.rhs.value)}`;
      }
      const signature = it.signature ? wrap`${ts.trivia(it.signature.trivia.open)}(${ts.wrap(it.signature.arguments.map(argument))}${ts.trivia(it.signature.trivia.close)})` : "";
      const separator = token(it.separator);
      return wrap`${ts.trivia(it.trivia.name)}${ts.extendedAttribute(wrap`${name}${rhs}${signature}`)}${separator}`;
    }
    function extended_attributes(eats) {
      if (!eats) return "";
      const members = ts.wrap(eats.items.map(make_ext_at));
      const trivia = extract_trivia(eats);
      return wrap`${trivia.open}[${members}${trivia.close}]`;
    }

    function operation(it, parent) {
      const ext = extended_attributes(it.extAttrs);
      const modifier = token(it.special);
      let bodyPart = "";
      if (it.body) {
        const { body } = it;
        const trivia = extract_trivia(it.body);
        const typePart = ts.type(type(body.idlType));
        const name = body.name ?
          token(body.name, ts.name(body.name.escaped, { data: it, parent })) :
          "";
        const args = wrap`${trivia.open}(${ts.wrap(body.arguments.map(argument))}${trivia.close})`;
        bodyPart = wrap`${typePart}${name}${args}`;
      }
      return ts.definition(
        wrap`${ext}${modifier}${bodyPart}${ts.trivia(it.trivia.termination)};`,
        { data: it, parent }
      );
    }

    function attribute(it, parent) {
      const ext = extended_attributes(it.extAttrs);
      const special = token(it.special);
      const readonly = token(it.readonly, "readonly");
      const prefixes = wrap`${ext}${special}${readonly}`;
      const name = ts.name(it.escapedName, { data: it, parent });
      const trivia = extract_trivia(it);
      return ts.definition(
        wrap`${prefixes}${typed_head(trivia, it, name)}${trivia.termination};`,
        { data: it, parent }
      );
    }

    function typed_head(trivia, it, name) {
      return wrap`${trivia.base}${it.type}${ts.type(type(it.idlType))}${trivia.name}${name}`;
    }

    function inheritance(inh) {
      if (!inh) {
        return "";
      }
      return ts.wrap([
        token(inh.tokens.colon),
        ts.trivia(inh.tokens.name.trivia),
        ts.inheritance(reference(inh.escapedName, inh.name))
      ]);
    }

    function container(it) {
      return ts.definition(ts.wrap([
        extended_attributes(it.extAttrs),
        token(it.tokens.partial),
        token(it.tokens.base),
        name_token(it.tokens.name, { data: it }),
        inheritance(it.inheritance),
        token(it.tokens.open),
        iterate(it.members, it),
        token(it.tokens.close),
        token(it.tokens.termination)
      ]), { data: it });
    }

    function brace_body(trivia, members) {
      return wrap`${trivia.open}{${members}${trivia.close}}${trivia.termination};`;
    }

    function interface_mixin(it) {
      const trivia = extract_trivia(it);
      const ext = extended_attributes(it.extAttrs);
      const partial = token(it.partial, "partial");
      const name = ts.name(it.escapedName, { data: it });
      const head = wrap`${trivia.base}interface${trivia.mixin}mixin${trivia.name}${name}`;
      const body = brace_body(trivia, iterate(it.members, it));
      return ts.definition(
        wrap`${ext}${partial}${head}${body}`,
        { data: it }
      );
    }
    function field(it, parent) {
      return ts.definition(ts.wrap([
        extended_attributes(it.extAttrs),
        token(it.tokens.required),
        ts.type(type(it.idlType)),
        name_token(it.tokens.name, { data: it, parent }),
        default_(it.default, it),
        token(it.tokens.termination)
      ]), { data: it, parent });
    }
    function const_(it, parent) {
      const trivia = extract_trivia(it);
      const ext = extended_attributes(it.extAttrs);
      const name = ts.name(it.name, { data: it, parent });
      const head = typed_head(trivia, it, name);
      const assign = wrap`${trivia.assign}=${trivia.value}${ts.valueLiteral(const_value(it.value), it)}`;
      return ts.definition(
        wrap`${ext}${head}${assign}${trivia.termination};`,
        { data: it, parent }
      );
    }
    function typedef(it) {
      return ts.definition(ts.wrap([
        extended_attributes(it.extAttrs),
        token(it.tokens.base),
        ts.type(type(it.idlType)),
        name_token(it.tokens.name, { data: it }),
        token(it.tokens.termination)
      ]), { data: it });
    }
    function includes(it) {
      return ts.definition(ts.wrap([
        extended_attributes(it.extAttrs),
        reference_token(it.tokens.target, it.target),
        token(it.tokens.includes),
        reference_token(it.tokens.mixin, it.includes),
        token(it.tokens.termination)
      ]), { data: it });
    }
    function callback(it) {
      const trivia = extract_trivia(it);
      const ext = extended_attributes(it.extAttrs);
      const name = ts.name(it.name, { data: it });
      const head = wrap`${trivia.base}callback${trivia.name}${name}`;
      const args = ts.wrap(it.arguments.map(argument));
      const signature = wrap`${ts.type(type(it.idlType))}${trivia.open}(${args}${trivia.close})`;
      return ts.definition(
        wrap`${ext}${head}${trivia.assign}=${signature}${trivia.termination};`,
        { data: it }
      );
    }
    function enum_(it) {
      return ts.definition(ts.wrap([
        extended_attributes(it.extAttrs),
        token(it.tokens.base),
        name_token(it.tokens.name, { data: it }),
        token(it.tokens.open),
        iterate(it.values, it),
        token(it.tokens.close),
        token(it.tokens.termination)
      ]), { data: it });
    }
    function enum_value(v, parent) {
      return wrap`${ts.trivia(v.trivia)}${
        ts.definition(wrap`"${ts.name(v.value, { data: v, parent })}"`, { data: v, parent })
      }${token(v.separator)}`;
    }
    function iterable_like(it, parent) {
      return ts.definition(ts.wrap([
        extended_attributes(it.extAttrs),
        token(it.tokens.readonly),
        token(it.tokens.base),
        token(it.tokens.open),
        ts.wrap(it.idlType.map(type)),
        token(it.tokens.close),
        token(it.tokens.termination)
      ]), { data: it, parent });
    }
    function callbackInterface(it) {
      return ts.definition(
        wrap`${ts.trivia(it.trivia.callback)}callback${container(it)}`,
        { data: it }
      );
    }
    function eof(it) {
      return ts.trivia(it.trivia);
    }

    const table = {
      interface: container,
      "interface mixin": interface_mixin,
      namespace: container,
      operation,
      attribute,
      dictionary: container,
      field,
      const: const_,
      typedef,
      includes,
      callback,
      enum: enum_,
      "enum-value": enum_value,
      iterable: iterable_like,
      legacyiterable: iterable_like,
      maplike: iterable_like,
      setlike: iterable_like,
      "callback interface": callbackInterface,
      eof
    };
    function dispatch(it, parent) {
      const dispatcher = table[it.type];
      if (!dispatcher) {
        throw new Error(`Type "${it.type}" is unsupported`);
      }
      return table[it.type](it, parent);
    }
    function iterate(things, parent) {
      if (!things) return;
      const results = things.map(thing => dispatch(thing, parent));
      return ts.wrap(results);
    }
    return iterate(ast);
  }

  const obj = {
    write
  };

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = obj;
  } else if (typeof define === 'function' && define.amd) {
    define([], () => obj);
  } else {
    (self || window).WebIDL2Writer = obj;
  }
})();
