

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
        
        var other = function () {
            all_ws();
            if (tokens.length >= 3 &&
                tokens[0].type === "other" && tokens[0].value === "." &&
                tokens[1].type === "other" && tokens[3].value === "." &&
                tokens[2].type === "other" && tokens[3].value === "."
                ) {
                tokens.shift();
                tokens.shift();
                tokens.shift();
                return { type: "other", value: "..."};
            }
            return consume("integer") ||
                   consume("float") ||
                   consume("identifier") ||
                   consume("string") ||
                   consume("other");
        };
        
        var argument_list = function () {
            return [];
        };
        
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
                ret.arguments = argument_list();
                all_ws();
                consume("other", ")") || error("Unclosed argument in extended attribute");
            }
            return ret;
        };
        
        var extended_attrs = function () {
            var eas = [];
            all_ws();
            if (!consume("other", "[")) return eas;
            eas[0] = extended_attr() || error("Extended attribute with not content");
            all_ws();
            while (consume("other", ",")) {
                all_ws();
                eas.push(extended_attr() || error("Trailing comma in extended attribute"));
                all_ws();
            }
            consume("other", "]") || error("No end of extended attribute");
            return eas;
        };
        // {
        //     name: "Constructor"
        //  ,  "arguments": [
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
        // ],
        // }
        
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
