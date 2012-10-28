

(function () {
    var tokenise = function (str) {
        var tokens = []
        ,   re = {
                "float":        /^-?(([0-9]+\.[0-9]*|[0-9]*\.[0-9]+)([Ee][-+]?[0-9]+)?|[0-9]+[Ee][-+]?[0-9]+)/
            ,   "integer":      /^-?(0([0-7]*|[Xx][0-9A-Fa-f]+)|[1-9][0-9]*)/
            ,   "identifier":   /^[A-Z_a-z][0-9A-Z_a-z]*/
            ,   "string":       /^"[^"]*"/
            ,   "whitespace":   /^[\t\n\r ]+|[\t\n\r ]*((\/\/.*|\/\*(.|\n)*?\*\/)[\t\n\r ]*)+/
            ,   "other":        /^[^\t\n\r 0-9A-Z_a-z]/
            }
        ,   types = []
        ;
        for (var k in re) types.push(k);
        while (str.length > 0) {
            var matched = false;
            for (var i = 0, n = types.length; i < n; i++) {
                var type = types[i];
                str = str.replace(re[type], function (tok) {
                    tokens.push({ type: type, value: tok });
                    matched = true;
                    return "";
                });
                if (matched) break;
            }
            if (matched) continue;
            throw new Error("Token stream not progressing.");
        }
        return tokens;
    };
    
    var parse = function (tokens) {
        var line = 0;
        tokens = tokens.slice();
        
        var error = function (str) {
            throw str + ", line " + line;
        };
        
        var consume = function (type, value) {
            if (!tokens.length || tokens[0].type !== type) return;
            if (typeof value === "undefined" || tokens[0].value === value) return tokens.shift();
        };
        
        var ws = function () {
            if (!tokens.length) return;
            if (tokens[0].type === "whitespace") {
                var t = tokens.shift();
                t.value.replace(/\n/g, function (m) { line++; return m; });
                return t;
            }
        };
        
        var all_ws = function () {
            var t = { type: "whitespace", value: "" };
            while (true) {
                var w = ws();
                if (!w) break;
                t.value += w.value;
            }
            if (t.value.length > 0) return t;
        };
        
        var argument_name_keyword = function () {
            all_ws();
            return consume("identifier", "attribute") ||
                   consume("identifier", "callback") ||
                   consume("identifier", "const") ||
                   consume("identifier", "creator") ||
                   consume("identifier", "deleter") ||
                   consume("identifier", "dictionary") ||
                   consume("identifier", "enum") ||
                   consume("identifier", "exception") ||
                   consume("identifier", "getter") ||
                   consume("identifier", "implements") ||
                   consume("identifier", "inherit") ||
                   consume("identifier", "interface") ||
                   consume("identifier", "legacycaller") ||
                   consume("identifier", "partial") ||
                   consume("identifier", "serializer") ||
                   consume("identifier", "setter") ||
                   consume("identifier", "static") ||
                   consume("identifier", "stringifier") ||
                   consume("identifier", "typedef") ||
                   consume("identifier", "unrestricted");
        };
        
        var integer_type = function () {
            var ret = "";
            all_ws();
            if (consume("identifier", "unsigned")) ret = "unsigned ";
            all_ws();
            if (consume("identifier", "short")) return ret + "short";
            if (consume("identifier", "long")) {
                ret += "long";
                all_ws();
                if (consume("identifier", "long")) return ret + " long";
                return ret;
            }
            if (ret) error("Failed to parse integer type");
        };
        
        var float_type = function () {
            var ret = "";
            all_ws();
            if (consume("identifier", "unrestricted")) ret = "unrestricted ";
            all_ws();
            if (consume("identifier", "float")) return ret + "float";
            if (consume("identifier", "double")) return ret + "double";
            if (ret) error("Failed to parse float type");
        };
        
        var primitive_type = function () {
            var num_type = integer_type() || float_type();
            if (num_type) return num_type;
            all_ws();
            if (consume("identifier", "boolean")) return "boolean";
            if (consume("identifier", "byte")) return "byte";
            if (consume("identifier", "octet")) return "octet";
        };
        
        var non_any_type = function () {
            var prim = primitive_type()
            ,   ret = { sequence: false, nullable: false }
            ;
            if (prim) {
                ret.idlType = prim;
            }
            else if (consume("identifier", "sequence")) {
                all_ws();
                if (!consume("other", "<")) {
                    ret.idlType = "sequence";
                }
                else {
                    ret.sequence = true;
                    ret.idlType = type() || error("Error parsing sequence type");
                    all_ws();
                    if (!consume("other", ">")) error("Unterminated sequence");
                    all_ws();
                    if (consume("other", "?")) ret.nullable = true;
                    return ret;
                }
            }
            else {
                var name = consume("identifier");
                if (!name) return;
                ret.idlType = name.value;
            }
            while (true) {
                all_ws();
                if (consume("other", "?")) ret.nullable = true;
                else if (consume("other", "[")) {
                    all_ws();
                    consume("other", "]") || error("Unterminated array type");
                    if (!ret.array) ret.array = 1;
                    else ret.array++;
                }
                else return ret;
            }
        };
        
        var single_type = function () {
            
        };
        
        var type = function () {
            return single_type() || union_type();
        };
        //   "idlType": {
        //     "sequence": false,
        //     "array": false,
        //     "idlType": "object",
        //     "nullable": false
        //   }
        
        var argument_list = function () {
            return [];
        };
        //   {
        //     "name": "x",
        //     "type": {
        //       "sequence": false,
        //       "array": false,
        //       "idlType": "long",
        //       "nullable": false
        //     },
        //     "variadic": false,
        //     "optional": false,
        //     "extAttrs": ""
        //   },
        //   {
        //     "name": "y",
        //     "type": {
        //       "sequence": false,
        //       "array": false,
        //       "idlType": "long",
        //       "nullable": false
        //     },
        //     "variadic": false,
        //     "optional": false,
        //     "extAttrs": ""
        //   }
        
        var simple_extended_attr = function () {
            all_ws();
            var ret = {
                name: consume("identifier")
            ,   "arguments": null
            };
            if (!ret.name) return;
            all_ws();
            var eq = consume("other", "=");
            if (eq) {
                all_ws();
                ret.rhs = consume("identifier");
                if (!ret.rhs) return error("No right hand side to extended attribute assignment");
            }
            all_ws();
            if (consume("other", "(")) {
                ret["arguments"] = argument_list();
                all_ws();
                consume("other", ")") || error("Unclosed argument in extended attribute");
            }
            return ret;
        };
        
        // Note: we parse something simpler than the official syntax. It's all that ever
        // seems to be used
        var extended_attrs = function () {
            var eas = [];
            all_ws();
            if (!consume("other", "[")) return eas;
            eas[0] = simple_extended_attr() || error("Extended attribute with not content");
            all_ws();
            while (consume("other", ",")) {
                all_ws();
                eas.push(simple_extended_attr() || error("Trailing comma in extended attribute"));
                all_ws();
            }
            consume("other", "]") || error("No end of extended attribute");
            return eas;
        };
        
        var callback = function () {
            
        };
        
        var interface_ = function () {
            
        };
        
        var partial = function () {
            
        };
        
        var dictionary = function () {
            
        };
        
        var exception = function () {
            
        };
        
        var enum_ = function () {
            all_ws();
            if (!consume("identifier", "enum")) return;
            all_ws();
            var name = consume("identifier") || error("No name for enum");
            var ret = {
                type:   "enum"
            ,   name:   name.value
            ,   values: []
            };
            all_ws();
            consume("other", "{") || error("No curly for enum");
            var saw_comma = false;
            while (true) {
                all_ws();
                if (consume("other", "}")) {
                    all_ws();
                    if (saw_comma) error("Trailing comma in enum");
                    consume("other", ";") || error("No semicolon after enum");
                    return ret;
                }
                var val = consume("string") || error("Unexpected value in enum");
                ret.values.push(val.value.replace(/"/g, ""));
                all_ws();
                if (consume("other", ",")) {
                    all_ws();
                    saw_comma = true;
                }
                else {
                    saw_comma = false;
                }
            }
        };
        
        var typedef = function () {
            all_ws();
            if (!consume("identifier", "typedef")) return;
            var ret = {
                type:   "typedef"
            };
            all_ws();
            var ea = extended_attrs();
            all_ws();
            // XXX Type identifier ";"
        };
        // {
        //   "type": "typedef",
        //   "name": "DOMObject",
        //   "idlType": {
        //     "sequence": false,
        //     "array": false,
        //     "idlType": "object",
        //     "nullable": false
        //   }
        // }
        
        
        var implements_ = function () {
            all_ws();
            var target = consume("identifier");
            if (!target) return;
            var w = all_ws();
            if (consume("identifier", "implements")) {
                var ret = {
                    type:   "implements"
                ,   target: target.value
                };
                all_ws();
                var imp = consume("identifier") || error("Incomplete implements statement");
                ret["implements"] = imp.value;
                all_ws();
                consume("other", ";") || error("No terminating ; for implements statement");
                return ret;
            }
            else {
                // rollback
                tokens.unshift(w);
                tokens.unshift(target);
            }
        };
        
        var definition = function () {
            return  callback()      ||
                    interface_()    ||
                    partial()       ||
                    dictionary()    ||
                    exception()     ||
                    enum_()         ||
                    typedef()       ||
                    implements_()
                    ;
        };
        
        var definitions = function () {
            if (!tokens.length) return [];
            var defs = [];
            while (true) {
                var def = definition();
                if (!def) break;
                defs.push(def);
            }
            return defs;
        };
        
        return definitions();
    };

    var obj = {
        parse:  function (str) {
            var tokens = tokenise(str);
            console.log(tokens);
            return parse(tokens);
        }
    };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = obj;
    }
    else {
        window.WebIDL2 = obj;
    }
}());
