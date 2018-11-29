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

    extendedAttribute: noop
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
    
    function reference(wrapped, normalized) {
      return ts.reference(wrapped, normalized || wrapped);
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
        return wrap`${trivia.base}${reference(it.baseName)}`;
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
      const name = wrap`${ts.trivia(it.trivia.name)}${reference(it.name)}`;
      let rhs = "";
      if (it.rhs) {
        const trivia = extract_trivia(it.rhs);
        if (it.rhs.type === "identifier-list") rhs = wrap`${trivia.assign}=${trivia.open}(${ts.wrap(it.rhs.value.map(identifier))}${trivia.close})`;
        else rhs = wrap`${trivia.assign}=${trivia.value}${reference(it.rhs.value)}`;
      }
      const signature = it.signature ? wrap`${ts.trivia(it.signature.trivia.open)}(${ts.wrap(it.signature.arguments.map(argument))}${ts.trivia(it.signature.trivia.close)})` : "";
      const separator = token(it.separator);
      return ts.extendedAttribute(wrap`${name}${rhs}${signature}${separator}`);
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
        const name = token(body.name, body.name && ts.name(body.name.escaped, { data: it, parent }));
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
        wrap`${prefixes}${trivia.base}attribute${ts.type(type(it.idlType))}${trivia.name}${name};`,
        { data: it, parent }
      );
    }

    function inheritance(inh) {
      if (!inh) {
        return "";
      }
      const trivia = extract_trivia(inh);
      return wrap`${trivia.colon}:${trivia.name}${ts.inheritance(reference(inh.name))}`;
    }

    function container(type) {
      return it => {
        const trivia = extract_trivia(it);
        const ext = extended_attributes(it.extAttrs);
        const partial = token(it.partial, "partial");
        const name = ts.name(it.escapedName, { data: it });
        const head = wrap`${trivia.base}${type}${trivia.name}${name}`;
        const inherit = inheritance(it.inheritance);
        const body = wrap`${trivia.open}{${iterate(it.members, it)}${trivia.close}}${trivia.termination};`;
        return ts.definition(
          wrap`${ext}${partial}${head}${inherit}${body}`,
          { data: it }
        );
      };
    }

    function interface_mixin(it) {
      const trivia = extract_trivia(it);
      const ext = extended_attributes(it.extAttrs);
      const partial = token(it.partial, "partial");
      const name = ts.name(it.escapedName, { data: it });
      const head = wrap`${trivia.base}interface${trivia.mixin}mixin${trivia.name}${name}`;
      const body = wrap`${trivia.open}{${iterate(it.members, it)}${trivia.close}}${trivia.termination};`;
      return ts.definition(
        wrap`${ext}${partial}${head}${body}`,
        { data: it }
      );
    }
    function field(it, parent) {
      const trivia = extract_trivia(it);
      const ext = extended_attributes(it.extAttrs);
      const required = token(it.required, "required");
      const name = ts.name(it.escapedName, { data: it, parent });
      const body = wrap`${ts.type(type(it.idlType))}${trivia.name}${name}`;
      const defaultValue = default_(it.default, it);
      return ts.definition(
        wrap`${ext}${required}${body}${defaultValue}${trivia.termination};`,
        { data: it, parent }
      );
    }
    function const_(it, parent) {
      const trivia = extract_trivia(it);
      const ret = extended_attributes(it.extAttrs);
      const name = ts.name(it.name, { data: it, parent });
      return ts.definition(
        wrap`${ret}${trivia.base}const${ts.type(type(it.idlType))}${trivia.name}${name}${trivia.assign}=${trivia.value}${ts.valueLiteral(const_value(it.value), it)}${trivia.termination};`,
        { data: it, parent }
      );
    }
    function typedef(it) {
      const trivia = extract_trivia(it);
      const ret = extended_attributes(it.extAttrs);
      const name = ts.name(it.escapedName, { data: it });
      return ts.definition(
        wrap`${ret}${trivia.base}typedef${ts.type(type(it.idlType))}${trivia.name}${name}${trivia.termination};`,
        { data: it }
      );
    }
    function includes(it) {
      const trivia = extract_trivia(it);
      const ret = extended_attributes(it.extAttrs);
      const target = reference(it.target);
      const mixin = reference(it.includes);
      return ts.definition(
        wrap`${ret}${trivia.target}${target}${trivia.includes}includes${trivia.mixin}${mixin}${trivia.termination};`,
        { data: it }
      );
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
      const trivia = extract_trivia(it);
      const ext = extended_attributes(it.extAttrs);
      const name = ts.name(it.escapedName, { data: it });
      const values = iterate(it.values, it);
      return ts.definition(
        wrap`${ext}${trivia.base}enum${trivia.name}${name}${trivia.open}{${values}${trivia.close}}${trivia.termination};`,
        { data: it }
      );
    }
    function enum_value(v, parent) {
      return wrap`${ts.trivia(v.trivia)}${
        ts.definition(`"${ts.name(v.value, { data: v, parent })}"`, { data: v, parent })
      }${token(v.separator)}`;
    }
    function iterable_like(it, parent) {
      const trivia = extract_trivia(it);
      const readonly = token(it.readonly, "readonly");
      const bracket = wrap`${trivia.open}<${ts.wrap(it.idlType.map(type))}${trivia.close}>`;
      return ts.definition(
        wrap`${readonly}${trivia.base}${it.type}${bracket}${trivia.termination};`,
        { data: it, parent }
      );
    }
    function callbackInterface(it) {
      return ts.definition(
        wrap`${ts.trivia(it.trivia.callback)}callback${container("interface", noop)(it)}`,
        { data: it }
      );
    }
    function eof(it) {
      return ts.trivia(it.trivia);
    }

    const table = {
      interface: container("interface"),
      "interface mixin": interface_mixin,
      namespace: container("namespace"),
      operation,
      attribute,
      dictionary: container("dictionary"),
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
