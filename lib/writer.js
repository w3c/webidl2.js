"use strict";

(() => {
  function write(ast, opt) {
    var curPea = "",
      curTPea = "",
      opt = opt || {},
      noop = str => str,
      optNames = "type".split(" "),
      context = [];
    for (const o of optNames) {
      if (!opt[o]) opt[o] = noop;
    }

    function literal(it) {
      return it.value;
    };
    function wsPea(it) {
      curPea += it.value;
      return "";
    };
    function wsTPea(it) {
      curTPea += it.value;
      return "";
    };
    function lineComment(it) {
      return "//" + it.value + "\n";
    };
    function multilineComment(it) {
      return "/*" + it.value + "*/";
    };
    function type(it) {
      if (typeof it === "string") return opt.type(it); // XXX should maintain some context
      if (it.union) return "(" + it.idlType.map(type).join(" or ") + ")";
      var ret = "";
      if (it.generic) ret += it.generic + "<";
      else if (it.sequence) ret += "sequence<";
      if (Array.isArray(it.idlType)) ret += it.idlType.map(type).join(", ");
      else ret += type(it.idlType);
      if (it.array || it.generic === 'Array') {
        for (const val of it.nullableArray) {
          if (val) ret += "?";
          ret += "[]";
        }
      }
      if (it.generic || it.sequence) ret += ">";
      if (it.nullable) ret += "?";

      return ret;
    };
    function const_value(it) {
      var tp = it.type;
      if (tp === "boolean") return it.value ? "true" : "false";
      else if (tp === "null") return "null";
      else if (tp === "Infinity") return (it.negative ? "-" : "") + "Infinity";
      else if (tp === "NaN") return "NaN";
      else if (tp === "number") return it.value;
      else return '"' + it.value + '"';
    };
    function argument(arg, pea) {
      var ret = extended_attributes(arg.extAttrs, pea);
      if (arg.optional) ret += "optional ";
      ret += type(arg.idlType);
      if (arg.variadic) ret += "...";
      ret += " " + arg.name;
      if (arg["default"]) ret += " = " + const_value(arg["default"]);
      return ret;
    };
    function args(its) {
      let res = "";
      let pea = "";
      for (let i = 0, n = its.length; i < n; i++) {
        const arg = its[i];
        if (arg.type === "ws") res += arg.value;
        else if (arg.type === "ws-pea") pea += arg.value;
        else {
          res += argument(arg, pea);
          if (i < n - 1) res += ",";
          pea = "";
        }
      }
      return res;
    };
    function make_ext_at(it) {
      if (it["arguments"] === null) return it.name;
      context.unshift(it);
      var ret = it.name + "(" + (it["arguments"].length ? args(it["arguments"]) : "") + ")";
      context.shift(); // XXX need to add more contexts, but not more than needed for ReSpec
      return ret;
    };
    function extended_attributes(eats, pea) {
      if (!eats || !eats.length) return "";
      return "[" + eats.map(make_ext_at).join(", ") + "]" + pea;
    };

    var modifiers = "getter setter creator deleter legacycaller stringifier static".split(" ");
    function operation(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      if (it.stringifier && !it.idlType) return "stringifier;";
      for (const mod of modifiers) {
        if (it[mod]) ret += mod + " ";
      }
      ret += type(it.idlType) + " ";
      if (it.name) ret += it.name;
      ret += "(" + args(it["arguments"]) + ");";
      return ret;
    };

    function attribute(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      if (it["static"]) ret += "static ";
      if (it.stringifier) ret += "stringifier ";
      if (it.readonly) ret += "readonly ";
      if (it.inherit) ret += "inherit ";
      ret += "attribute " + type(it.idlType) + " " + it.name + ";";
      return ret;
    };

    function interface_(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      if (it.partial) ret += "partial ";
      ret += "interface " + it.name + " ";
      if (it.inheritance) ret += ": " + it.inheritance + " ";
      ret += "{" + iterate(it.members) + "};";
      return ret;
    };

    function dictionary(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      if (it.partial) ret += "partial ";
      ret += "dictionary " + it.name + " ";
      ret += "{" + iterate(it.members) + "};";
      return ret;
    };
    function field(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      if (it.required) ret += "required ";
      ret += type(it.idlType) + " " + it.name;
      if (it["default"]) ret += " = " + const_value(it["default"]);
      ret += ";";
      return ret;
    };
    function exception(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      ret += "exception " + it.name + " ";
      if (it.inheritance) ret += ": " + it.inheritance + " ";
      ret += "{" + iterate(it.members) + "};";
      return ret;
    };
    function const_(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      return ret + "const " + type(it.idlType) + " " + it.name + " = " + const_value(it.value) + ";";
    };
    function typedef(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      ret += "typedef " + extended_attributes(it.typeExtAttrs, curTPea);
      curTPea = "";
      return ret + type(it.idlType) + " " + it.name + ";";
    };
    function implements_(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      return ret + it.target + " implements " + it["implements"] + ";";
    };
    function callback(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      return ret + "callback " + it.name + " = " + type(it.idlType) +
        "(" + args(it["arguments"]) + ");";
    };
    function enum_(it) {
      var ret = extended_attributes(it.extAttrs, curPea);
      curPea = "";
      ret += "enum " + it.name + " {";
      for (const v of it.values) {
        if (typeof v === "string") ret += '"' + v + '"';
        else if (v.type === "ws") ret += v.value;
        else if (v.type === ",") ret += ",";
      }
      return ret + "};";
    };
    function iterable(it) {
      return "iterable<" + (it.idlType instanceof Array ? it.idlType.map(type).join(", ") : type(it.idlType)) + ">;";
    };
    function legacyiterable(it) {
      return "legacyiterable<" + (it.idlType instanceof Array ? it.idlType.map(type).join(", ") : type(it.idlType)) + ">;";
    };
    function maplike(it) {
      return (it.readonly ? "readonly " : "") + "maplike<" +
        it.idlType.map(type).join(", ") + ">;";
    };
    function setlike(it) {
      return (it.readonly ? "readonly " : "") + "setlike<" +
        type(it.idlType) + ">;";
    };
    function callbackInterface(it) {
      return 'callback ' + interface_(it);
    };

    var table = {
      ws: literal,
      "ws-pea": wsPea,
      "ws-tpea": wsTPea,
      "line-comment": lineComment,
      "multiline-comment": multilineComment,
      "interface": interface_,
      operation,
      attribute,
      dictionary,
      field,
      exception,
      "const": const_,
      typedef,
      "implements": implements_,
      callback,
      "enum": enum_,
      iterable,
      legacyiterable,
      maplike,
      setlike,
      "callback interface": callbackInterface
    };
    function dispatch(it) {
      return table[it.type](it);
    };
    function iterate(things) {
      if (!things) return;
      var ret = "";
      for (const thing of things) ret += dispatch(thing);
      return ret;
    };
    return iterate(ast);
  };


  var obj = {
    write: function(ast, opt) {
      if (!opt) opt = {};
      return write(ast, opt);
    }
  };

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = obj;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() {
      return obj;
    });
  } else {
    (self || window).WebIDL2Writer = obj;
  }
})();
