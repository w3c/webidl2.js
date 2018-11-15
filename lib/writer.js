"use strict";

(() => {
  /**
   * @param {string[]} strings 
   * @param  {...any} args 
   */
  function noopTag(strings, ...args) {
    return strings.map((s, i) => s + (args[i] || "")).join("");
  }

  function noopArray(args) {
    return args.join("");
  }

  function noop(arg) {
    return arg;
  }

  const templates = {
    wrap: noopTag,
    name: noop,
    includes: noop
  };

  /**
   * @param {any[]} args 
   */
  function arrayToStringTagAdapter(args) {
    return [
      new Array(args.length + 1).fill(""),
      ...args
    ];
  }
  function write(ast, { templates: ts = templates } = {}) {
    ts = { ...templates, ...ts };

    function token(t, value) {
      return t ? t.trivia + (value || t.escaped || t.value) : "";
    }

    function type_body(it) {
      if (it.union) {
        const subtypes = it.idlType.map(type).join("");
        return ts.wrap`${it.trivia.open}(${subtypes}${it.trivia.close})`;
      } else if (it.generic) {
        const genericName = ts.wrap`${it.trivia.base}${it.generic.value}`;
        const subtypes = it.idlType.map(type).join("");
        const { trivia } = it.generic;
        const bracket = ts.wrap`${trivia.open}<${subtypes}${trivia.close}>`;
        return ts.wrap`${genericName}${bracket}`;
      }
      const prefix = token(it.prefix);
      const base = it.trivia.base + it.baseName;
      const postfix = token(it.postfix);
      return ts.wrap`${prefix}${base}${postfix}`;
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
      let ret = extended_attributes(arg.extAttrs);
      ret += token(arg.optional, "optional");
      ret += type(arg.idlType);
      ret += token(arg.variadic, "...");
      ret += ts.wrap`${arg.trivia.name}${arg.escapedName}`;
      ret += default_(arg.default);
      ret += token(arg.separator);
      return ret;
    }
    function identifier(id) {
      return id.trivia + id.value + token(id.separator);
    }
    function make_ext_at(it) {
      let ret = it.trivia.name + it.name;
      if (it.rhs) {
        if (it.rhs.type === "identifier-list") ret += ts.wrap`${it.rhs.trivia.assign}=${it.rhs.trivia.open}(${it.rhs.value.map(identifier).join("")}${it.rhs.trivia.close})`;
        else ret += ts.wrap`${it.rhs.trivia.assign}=${it.rhs.trivia.value}${it.rhs.value}`;
      }
      if (it.signature) ret += ts.wrap`${it.signature.trivia.open}(${it.signature.arguments.map(argument).join("")}${it.signature.trivia.close})`;
      ret += token(it.separator);
      return ret;
    }
    function extended_attributes(eats) {
      if (!eats) return "";
      return ts.wrap`${eats.trivia.open}[${eats.items.map(make_ext_at).join("")}${eats.trivia.close}]`;
    }

    function operation(it) {
      let ret = extended_attributes(it.extAttrs);
      ret += token(it.special);
      if (it.body) {
        const { body } = it;
        ret += type(body.idlType);
        ret += token(body.name);
        ret += ts.wrap`${body.trivia.open}(${body.arguments.map(argument).join("")}${body.trivia.close})`;
      }
      ret += it.trivia.termination + ";";
      return ret;
    }

    function attribute(it) {
      let ret = extended_attributes(it.extAttrs);
      ret += token(it.special);
      ret += token(it.readonly, "readonly");
      ret += ts.wrap`${it.trivia.base}attribute${type(it.idlType)}${it.trivia.name}${it.escapedName};`;
      return ret;
    }

    function inheritance(inh) {
      if (!inh) {
        return "";
      }
      return ts.wrap`${inh.trivia.colon}:${inh.trivia.name}${inh.name}`;
    }

    function container(type) {
      return it => {
        let ret = extended_attributes(it.extAttrs);
        ret += token(it.partial, "partial");
        ret += ts.wrap`${it.trivia.base}${type}${it.trivia.name}${it.escapedName}`;
        ret += inheritance(it.inheritance);
        ret += ts.wrap`${it.trivia.open}{${iterate(it.members)}${it.trivia.close}}${it.trivia.termination};`;
        return ret;
      };
    }

    function interface_mixin(it) {
      let ret = extended_attributes(it.extAttrs);
      ret += token(it.partial, "partial");
      ret += ts.wrap`${it.trivia.base}interface${it.trivia.mixin}mixin${it.trivia.name}${it.escapedName}`;
      ret += ts.wrap`${it.trivia.open}{${iterate(it.members)}${it.trivia.close}}${it.trivia.termination};`;
      return ret;
    }

    function field(it) {
      let ret = extended_attributes(it.extAttrs);
      ret += token(it.required, "required");
      ret += ts.wrap`${type(it.idlType)}${it.trivia.name}${it.escapedName}`;
      ret += default_(it.default);
      ret += ts.wrap`${it.trivia.termination};`;
      return ret;
    }
    function const_(it) {
      const ret = extended_attributes(it.extAttrs);
      return ts.wrap`${ret}${it.trivia.base}const${type(it.idlType)}${it.trivia.name}${it.name}${it.trivia.assign}=${it.trivia.value}${const_value(it.value)}${it.trivia.termination};`;
    }
    function typedef(it) {
      const ret = extended_attributes(it.extAttrs);
      return ts.wrap`${ret}${it.trivia.base}typedef${type(it.idlType)}${it.trivia.name}${it.escapedName}${it.trivia.termination};`;
    }
    function includes(it) {
      const ret = extended_attributes(it.extAttrs);
      const target = ts.name(it.target);
      const mixin = ts.name(it.includes);
      return ts.includes(
        ts.wrap
          `${ret}${it.trivia.target}${target}${it.trivia.includes}includes${it.trivia.mixin}${mixin}${it.trivia.termination};`
      );
    }
    function callback(it) {
      const ext = extended_attributes(it.extAttrs);
      const head = ts.wrap`${it.trivia.base}callback${it.trivia.name}${it.name}`;
      const args = it.arguments.map(argument).join("");
      const signature = ts.wrap`${type(it.idlType)}${it.trivia.open}(${args}${it.trivia.close})`;
      return ts.wrap`${ext}${head}${it.trivia.assign}=${signature}${it.trivia.termination};`;
    }
    function enum_(it) {
      const ext = extended_attributes(it.extAttrs);
      const values = it.values.map(
        v => ts.wrap`${v.trivia}"${v.value}"${token(v.separator)}`
      ).join("");
      return ts.wrap`${ext}${it.trivia.base}enum${it.trivia.name}${it.escapedName}${it.trivia.open}{${values}${it.trivia.close}}${it.trivia.termination};`;
    }
    function iterable_like(it) {
      const readonly = it.readonly ? ts.wrap`${it.readonly.trivia}readonly` : "";
      const bracket = ts.wrap`${it.trivia.open}<${it.idlType.map(type).join("")}${it.trivia.close}>`;
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
      return ts.wrap(...arrayToStringTagAdapter(results));
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
