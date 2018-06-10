"use strict";

(() => {
  function write(ast) {
    function type(it) {
      let ret = extended_attributes(it.extAttrs);
      if (it.prefix) ret += it.prefix.trivia + it.prefix.value;
      if (it.union) ret += `${it.trivia.open}(${it.idlType.map(type).join("")}${it.trivia.close})`;
      else if (it.generic) ret += `${it.trivia.base}${it.generic.value}${it.generic.trivia.open}<${it.idlType.map(type).join("")}${it.generic.trivia.close}>`;
      else {
        ret += it.trivia.base;
        ret += typeof it.idlType === "string" ? it.baseName : type(it.idlType);
      }
      if (it.postfix) ret += it.postfix.trivia + it.postfix.value;
      if (it.nullable) ret += `${it.nullable.trivia}?`;
      if (it.separator) ret += it.separator.trivia + it.separator.value;

      return ret;
    };
    function const_value(it) {
      const tp = it.type;
      if (tp === "boolean") return it.value ? "true" : "false";
      else if (tp === "null") return "null";
      else if (tp === "Infinity") return (it.negative ? "-" : "") + "Infinity";
      else if (tp === "NaN") return "NaN";
      else if (tp === "number") return it.value;
      else if (tp === "sequence") return "[]";
      else return `"${it.value}"`;
    };
    function argument(arg) {
      let ret = extended_attributes(arg.extAttrs);
      if (arg.optional) ret += "optional";
      ret += type(arg.idlType);
      if (arg.variadic) ret += "...";
      ret += ` ${arg.escapedName}`;
      if (arg.default) ret += ` = ${const_value(arg.default)}`;
      return ret;
    };
    function make_ext_at(it) {
      let ret = it.name;
      if (it.rhs) {
        if (it.rhs.type === "identifier-list") ret += `=(${it.rhs.value.join(",")})`;
        else ret += `=${it.rhs.value}`;
      }
      if (it.arguments) ret += `(${it.arguments.map(argument).join(",")})`;
      return ret;
    };
    function extended_attributes(eats) {
      if (!eats || !eats.length) return "";
      return `[${eats.map(make_ext_at).join(", ")}]`;
    };

    function operation(it) {
      let ret = extended_attributes(it.extAttrs);
      if (it.stringifier && !it.idlType) return `${it.stringifier.trivia}stringifier;`;
      for (const mod of ["getter", "setter", "deleter", "stringifier", "static"]) {
        if (it[mod]) ret += `${it[mod].trivia}${mod}`;
      }
      ret += type(it.idlType) + " ";
      if (it.name) ret += it.escapedName;
      ret += `(${it.arguments.map(argument).join(",")});`;
      return ret;
    };

    function attribute(it) {
      let ret = extended_attributes(it.extAttrs);
      if (it.static) ret += `${it.static.trivia}static`;
      if (it.stringifier) ret += `${it.stringifier.trivia}stringifier`;
      if (it.inherit) ret += `${it.inherit.trivia}inherit`;
      if (it.readonly) ret += `${it.readonly.trivia}readonly`;
      ret += `${it.trivia.base}attribute${type(it.idlType)}${it.trivia.name}${it.escapedName};`;
      return ret;
    };

    function interface_(it) {
      let ret = extended_attributes(it.extAttrs);
      if (it.partial) ret += "partial";
      ret += `${it.trivia.base}interface${it.trivia.name}${it.name}`;
      if (it.inheritance) ret += `: ${it.inheritance}`;
      ret += `${it.trivia.open}{${iterate(it.members)}${it.trivia.close}}${it.trivia.termination};`;
      return ret;
    };

    function interface_mixin(it) {
      let ret = extended_attributes(it.extAttrs);
      if (it.partial) ret += "partial";
      ret += `${it.trivia.base}interface${it.trivia.mixin}mixin ${it.name} `;
      ret += `{${iterate(it.members)}};`;
      return ret;
    }

    function namespace(it) {
      let ret = extended_attributes(it.extAttrs);
      if (it.partial) ret += "partial ";
      ret += `namespace ${it.name} `;
      ret += `{${iterate(it.members)}};`;
      return ret;
    }

    function dictionary(it) {
      let ret = extended_attributes(it.extAttrs);
      if (it.partial) ret += "partial ";
      ret += `dictionary ${it.name} `;
      if (it.inheritance) ret += `: ${it.inheritance} `;
      ret += `{${iterate(it.members)}};`;
      return ret;
    };
    function field(it) {
      let ret = extended_attributes(it.extAttrs);
      if (it.required) ret += "required";
      ret += `${type(it.idlType)} ${it.escapedName}`;
      if (it.default) ret += ` = ${const_value(it.default)}`;
      ret += ";";
      return ret;
    };
    function const_(it) {
      const ret = extended_attributes(it.extAttrs);
      return `${ret}const${type(it.idlType)} ${it.name} = ${const_value(it.value)};`;
    };
    function typedef(it) {
      let ret = extended_attributes(it.extAttrs);
      return `${ret}typedef${type(it.idlType)} ${it.name};`;
    };
    function implements_(it) {
      const ret = extended_attributes(it.extAttrs);
      return `${ret}${it.target} implements ${it.implements};`;
    };
    function includes(it) {
      const ret = extended_attributes(it.extAttrs);
      return `${ret}${it.target} includes ${it.includes};`;
    };
    function callback(it) {
      const ret = extended_attributes(it.extAttrs);
      const args = it.arguments.map(argument).join(",");
      return `${ret}callback ${it.name} =${type(it.idlType)}(${args});`;
    };
    function enum_(it) {
      const ext = extended_attributes(it.extAttrs);
      const values = it.values.map(v => `"${v.value}",`).join("");
      return `${ext}enum ${it.name} {${values}};`;
    };
    function iterable_like(it) {
      const readonly = it.readonly ? `${it.readonly.trivia}readonly` : "";
      return `${readonly}${it.trivia.type}${it.type}${it.trivia.open}<${it.idlType.map(type).join("")}${it.trivia.close}>${it.trivia.termination};`;
    };
    function callbackInterface(it) {
      return `callback${interface_(it)}`;
    };

    const table = {
      interface: interface_,
      "interface mixin": interface_mixin,
      namespace,
      operation,
      attribute,
      dictionary,
      field,
      const: const_,
      typedef,
      implements: implements_,
      includes,
      callback,
      enum: enum_,
      iterable: iterable_like,
      legacyiterable: iterable_like,
      maplike: iterable_like,
      setlike: iterable_like,
      "callback interface": callbackInterface
    };
    function dispatch(it) {
      const dispatcher = table[it.type];
      if (!dispatcher) {
        throw new Error(`Type "${it.type}" is unsupported`)
      }
      return table[it.type](it);
    };
    function iterate(things) {
      if (!things) return;
      let ret = "";
      for (const thing of things) ret += dispatch(thing);
      return ret;
    };
    return iterate(ast);
  };


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
