"use strict";

(() => {
  /**
   * @param {string[]} strings 
   * @param  {...any} args 
   */
  function noopTag(strings, ...args) {
    return strings.map((s, i) => s + (args[i] || "")).join("");
  }

  function noop(arg) {
    return arg;
  }

  const templates = {
    wrap: noopTag,
    trivia: noop,
    name: noop,
    reference: noop,
    includes: noop
  };

  function write(ast, { templates: ts = templates } = {}) {
    ts = Object.assign({}, templates, ts);

    function collect(args) {
      return ts.wrap(new Array(args.length + 1).fill(""), ...args);
    }

    function extract_trivia(object) {
      const batch = {};
      for (const key in object.trivia) {
        batch[key] = ts.trivia(object.trivia[key]);
      }
      return batch;
    }

    function token(t, value) {
      return t ? ts.wrap`${ts.trivia(t.trivia)}${value || t.value}` : "";
    }

    function type_body(it) {
      const trivia = extract_trivia(it);
      if (it.union) {
        const subtypes = collect(it.idlType.map(type));
        return ts.wrap`${trivia.open}(${subtypes}${trivia.close})`;
      } else if (it.generic) {
        const genericName = ts.wrap`${trivia.base}${ts.reference(it.generic.value)}`;
        const subtypes = collect(it.idlType.map(type));
        const { trivia: gTrivia } = it.generic;
        return ts.wrap`${genericName}${gTrivia.open}<${subtypes}${gTrivia.close}>`;
      }
      const base = ts.wrap`${trivia.base}${ts.reference(it.baseName)}`;
      return ts.wrap`${token(it.prefix)}${base}${token(it.postfix)}`;
    }
    function type(it) {
      const ext = extended_attributes(it.extAttrs);
      const body = type_body(it);
      const nullable = token(it.nullable, "?");
      const separator = token(it.separator);
      return ts.wrap`${ext}${body}${nullable}${separator}`;
    }
    function const_value(it) {
      const tp = it.type;
      if (tp === "boolean") return it.value ? "true" : "false";
      else if (tp === "null") return "null";
      else if (tp === "Infinity") return (it.negative ? "-" : "") + "Infinity";
      else if (tp === "NaN") return "NaN";
      else if (tp === "number") return it.value;
      else return ts.wrap`"${it.value}"`;
    }
    function default_(def) {
      if (!def) {
        return "";
      }
      const assign = ts.wrap`${def.trivia.assign}=`;
      if (def.type === "sequence") {
        return ts.wrap`${assign}${def.trivia.open}[${def.trivia.close}]`;
      }
      return ts.wrap`${assign}${def.trivia.value}${const_value(def)}`;
    }
    function argument(arg) {
      const ext = extended_attributes(arg.extAttrs);
      const optional = token(arg.optional, "optional");
      const typePart = type(arg.idlType);
      const variadic = token(arg.variadic, "...");
      const name = ts.wrap`${arg.trivia.name}${ts.name(arg.escapedName)}`;
      const defaultValue = default_(arg.default);
      const separator = token(arg.separator);
      return ts.wrap`${ext}${optional}${typePart}${variadic}${name}${defaultValue}${separator}`;
    }
    function identifier(id) {
      return ts.wrap`${id.trivia}${ts.reference(id.value)}${token(id.separator)}`;
    }
    function make_ext_at(it) {
      const name = ts.wrap`${it.trivia.name}${ts.reference(it.name)}`;
      let rhs = "";
      if (it.rhs) {
        if (it.rhs.type === "identifier-list") rhs = ts.wrap`${it.rhs.trivia.assign}=${it.rhs.trivia.open}(${collect(it.rhs.value.map(identifier))}${it.rhs.trivia.close})`;
        else rhs = ts.wrap`${it.rhs.trivia.assign}=${it.rhs.trivia.value}${ts.reference(it.rhs.value)}`;
      }
      const signature = it.signature ? ts.wrap`${it.signature.trivia.open}(${collect(it.signature.arguments.map(argument))}${it.signature.trivia.close})` : "";
      const separator = token(it.separator);
      return ts.wrap`${name}${rhs}${signature}${separator}`;
    }
    function extended_attributes(eats) {
      if (!eats) return "";
      const members = collect(eats.items.map(make_ext_at));
      return ts.wrap`${eats.trivia.open}[${members}${eats.trivia.close}]`;
    }

    function operation(it) {
      const ext = extended_attributes(it.extAttrs);
      const modifier = token(it.special);
      let bodyPart = "";
      if (it.body) {
        const { body } = it;
        const typePart = type(body.idlType);
        const name = body.name ? ts.wrap`${body.name.trivia}${ts.name(body.name.escaped)}` : "";
        const args = ts.wrap`${body.trivia.open}(${collect(body.arguments.map(argument))}${body.trivia.close})`;
        bodyPart = ts.wrap`${typePart}${name}${args}`;
      }
      return ts.wrap`${ext}${modifier}${bodyPart}${it.trivia.termination};`;
    }

    function attribute(it) {
      const ext = extended_attributes(it.extAttrs);
      const special = token(it.special);
      const readonly = token(it.readonly, "readonly");
      const prefixes = ts.wrap`${ext}${special}${readonly}`;
      const name = ts.name(it.escapedName);
      return ts.wrap`${prefixes}${it.trivia.base}attribute${type(it.idlType)}${it.trivia.name}${name};`;
    }

    function inheritance(inh) {
      if (!inh) {
        return "";
      }
      return ts.wrap`${inh.trivia.colon}:${inh.trivia.name}${ts.reference(inh.name)}`;
    }

    function container(type) {
      return it => {
        const ext = extended_attributes(it.extAttrs);
        const partial = token(it.partial, "partial");
        const name = ts.name(it.escapedName);
        const head = ts.wrap`${it.trivia.base}${type}${it.trivia.name}${name}`;
        const inherit = inheritance(it.inheritance);
        const body = ts.wrap`${it.trivia.open}{${iterate(it.members)}${it.trivia.close}}${it.trivia.termination};`;
        return ts.wrap`${ext}${partial}${head}${inherit}${body}`;
      };
    }

    function interface_mixin(it) {
      const ext = extended_attributes(it.extAttrs);
      const partial = token(it.partial, "partial");
      const name = ts.name(it.escapedName);
      const head = ts.wrap`${it.trivia.base}interface${it.trivia.mixin}mixin${it.trivia.name}${name}`;
      const body = ts.wrap`${it.trivia.open}{${iterate(it.members)}${it.trivia.close}}${it.trivia.termination};`;
      return ts.wrap`${ext}${partial}${head}${body}`;
    }
    function field(it) {
      const ext = extended_attributes(it.extAttrs);
      const required = token(it.required, "required");
      const name = ts.name(it.escapedName);
      const body = ts.wrap`${type(it.idlType)}${it.trivia.name}${name}`;
      const defaultValue = default_(it.default);
      return ts.wrap`${ext}${required}${body}${defaultValue}${it.trivia.termination};`;
    }
    function const_(it) {
      const ret = extended_attributes(it.extAttrs);
      const name = ts.name(it.name);
      return ts.wrap`${ret}${it.trivia.base}const${type(it.idlType)}${it.trivia.name}${name}${it.trivia.assign}=${it.trivia.value}${const_value(it.value)}${it.trivia.termination};`;
    }
    function typedef(it) {
      const ret = extended_attributes(it.extAttrs);
      const name = ts.name(it.escapedName);
      return ts.wrap`${ret}${it.trivia.base}typedef${type(it.idlType)}${it.trivia.name}${name}${it.trivia.termination};`;
    }
    function includes(it) {
      const ret = extended_attributes(it.extAttrs);
      const target = ts.reference(it.target);
      const mixin = ts.reference(it.includes);
      return ts.includes(
        ts.wrap`${ret}${it.trivia.target}${target}${it.trivia.includes}includes${it.trivia.mixin}${mixin}${it.trivia.termination};`
      );
    }
    function callback(it) {
      const ext = extended_attributes(it.extAttrs);
      const name = ts.name(it.name);
      const head = ts.wrap`${it.trivia.base}callback${it.trivia.name}${name}`;
      const args = collect(it.arguments.map(argument));
      const signature = ts.wrap`${type(it.idlType)}${it.trivia.open}(${args}${it.trivia.close})`;
      return ts.wrap`${ext}${head}${it.trivia.assign}=${signature}${it.trivia.termination};`;
    }
    function enum_(it) {
      const ext = extended_attributes(it.extAttrs);
      const name = ts.name(it.escapedName);
      const values = iterate(it.values);
      return ts.wrap`${ext}${it.trivia.base}enum${it.trivia.name}${name}${it.trivia.open}{${values}${it.trivia.close}}${it.trivia.termination};`;
    }
    function enum_value(v) {
      return ts.wrap`${v.trivia}"${ts.name(v.value)}"${token(v.separator)}`;
    }
    function iterable_like(it) {
      const readonly = it.readonly ? ts.wrap`${it.readonly.trivia}readonly` : "";
      const bracket = ts.wrap`${it.trivia.open}<${collect(it.idlType.map(type))}${it.trivia.close}>`;
      return ts.wrap`${readonly}${it.trivia.base}${it.type}${bracket}${it.trivia.termination};`;
    }
    function callbackInterface(it) {
      return ts.wrap`${it.trivia.callback}callback${container("interface")(it)}`;
    }
    function eof(it) {
      return it.trivia;
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
    function dispatch(it) {
      const dispatcher = table[it.type];
      if (!dispatcher) {
        throw new Error(`Type "${it.type}" is unsupported`);
      }
      return table[it.type](it);
    }
    function iterate(things) {
      if (!things) return;
      const results = things.map(dispatch);
      return collect(results);
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
