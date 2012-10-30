

(function () {
    var tokenise = function (str) {
        var tokens = []
        ,   re = {
                "float":        /^-?(([0-9]+\.[0-9]*|[0-9]*\.[0-9]+)([Ee][-+]?[0-9]+)?|[0-9]+[Ee][-+]?[0-9]+)/
            ,   "integer":      /^-?(0([Xx][0-9A-Fa-f]+|[0-7]*)|[1-9][0-9]*)/
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
        var line = 1;
        tokens = tokens.slice();
        
        var error = function (str) {
            var tok = "", numTokens = 0, maxTokens = 5;
            while (numTokens < maxTokens && tokens.length > numTokens) {
                tok += tokens[numTokens].value;
                numTokens++;
            }
            throw str + ", line " + line + " (tokens: '" + tok + "')\n" + JSON.stringify(tokens.slice(0, 5), null, 4);
        };
        
        var last_token = null;
        
        var consume = function (type, value) {
            if (!tokens.length || tokens[0].type !== type) return;
            if (typeof value === "undefined" || tokens[0].value === value) {
                 last_token = tokens.shift();
                 return last_token;
             }
        };
        
        var ws = function () {
            if (!tokens.length) return;
            // console.log("tokens.length", tokens.length, tokens[0]);
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
        
        var const_value = function () {
            if (consume("identifier", "true")) return true;
            if (consume("identifier", "false")) return false;
            if (consume("identifier", "null")) return null;
            if (consume("identifier", "Infinity")) return Infinity;
            if (consume("identifier", "NaN")) return NaN;
            var ret = consume("float") || consume("integer");
            if (ret) return 1 * ret.value;
            var tok = consume("other", "-");
            if (tok) {
                if (consume("identifier", "Infinity")) return -Infinity;
                else tokens.unshift(tok);
            }
        };
        
        var type_suffix = function (obj) {
            while (true) {
                all_ws();
                if (consume("other", "?")) obj.nullable = true;
                else if (consume("other", "[")) {
                    all_ws();
                    consume("other", "]") || error("Unterminated array type");
                    if (!obj.array) obj.array = 1;
                    else obj.array++;
                }
                else return;
            }
        };
        
        var single_type = function () {
            var prim = primitive_type()
            ,   ret = { sequence: false, nullable: false, array: false, union: false }
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
            type_suffix(ret);
            return ret;
        };
        
        var union_type = function () {
            all_ws();
            if (!consume("other", "(")) return;
            var ret = { sequence: false, nullable: false, array: false, union: true, idlType: [] };
            var fst = type() || error("Union type with no content");
            ret.idlType.push(fst);
            while (true) {
                all_ws();
                if (!consume("identifier", "or")) break;
                var typ = type() || error("No type after 'or' in union type");
                ret.idlType.push(typ);
            }
            if (!consume("other", ")")) error("Unterminated union type");
            type_suffix(ret);
            return ret;
        };
        
        var type = function () {
            return single_type() || union_type();
        };
        
        var argument = function () {
            var ret = { optional: false, variadic: false };
            ret.extAttrs = extended_attrs();
            all_ws();
            if (consume("identifier", "optional")) {
                ret.optional = true;
                all_ws();
            }
            ret.type = type();
            if (!ret.type) return;
            if (!ret.optional) {
                all_ws();
                if (tokens.length >= 3 &&
                    tokens[0].type === "other" && tokens[0].value === "." &&
                    tokens[1].type === "other" && tokens[1].value === "." &&
                    tokens[2].type === "other" && tokens[2].value === "."
                    ) {
                    tokens.shift();
                    tokens.shift();
                    tokens.shift();
                    ret.variadic = true;
                }
            }
            all_ws();
            var name = consume("identifier") || error("No name in argument");
            ret.name = name.value;
            if (ret.optional) {
                all_ws();
                ret["default"] = default_();
            }
            return ret;
        };
        
        var argument_list = function () {
            var arg = argument(), ret = [];
            if (!arg) return ret;
            ret.push(arg);
            while (true) {
                all_ws();
                if (!consume("other", ",")) return ret;
                all_ws();
                var nxt = argument() || error("Trailing comma in arguments list");
                ret.push(nxt);
            }
        };
        
        var simple_extended_attr = function () {
            all_ws();
            var name = consume("identifier");
            if (!name) return;
            var ret = {
                name: name.value
            ,   "arguments": null
            };
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
        
        var default_ = function () {
            all_ws();
            if (consume("other", "=")) {
                all_ws();
                var def = const_value();
                if (typeof def !== "undefined") {
                    return def;
                }
                else {
                    var str = consume("string") || error("No value for default");
                    return str;
                }
            }
        };
        
        var const_ = function () {
            all_ws();
            if (!consume("identifier", "const")) return;
            var ret = { type: "const", nullable: false };
            all_ws();
            var typ = primitive_type();
            if (!typ) {
                typ = consume("identifier") || error("No type for const");
                typ = typ.value;
            }
            ret.idlType = typ;
            all_ws();
            if (consume("other", "?")) {
                ret.nullable = true;
                all_ws();
            }
            var name = consume("identifier") || error("No name for const");
            ret.name = name.value;
            all_ws();
            consume("other", "=") || error("No value assignment for const");
            all_ws();
            var cnt = const_value();
            if (typeof cnt !== "undefined") ret.value = cnt;
            else error("No value for const");
            all_ws();
            consume("other", ";") || error("Unterminated const");
            return ret;
        };
        
        var inheritance = function () {
            all_ws();
            if (consume("other", ":")) {
                all_ws();
                var inh = consume("identifier") || error ("No type in inheritance");
                return inh.value;
            }
        };
        
        var operation_rest = function (ret) {
            all_ws();
            if (!ret) ret = {};
            var name = consume("identifier");
            ret.name = name ? name.value : null;
            all_ws();
            consume("other", "(") || error("Invalid operation");
            ret["arguments"] = argument_list();
            all_ws();
            consume("other", ")") || error("Unterminated operation");
            all_ws();
            consume("other", ";") || error("Unterminated operation");
            return ret;
        };
        
        var callback = function () {
            all_ws();
            var ret;
            if (!consume("identifier", "callback")) return;
            all_ws();
            var tok = consume("identifier", "interface");
            if (tok) {
                tokens.unshift(tok);
                ret = interface_();
                ret.type = "callback interface";
                return ret;
            }
            var name = consume("identifier") || error("No name for callback");
            ret = { type: "callback", name: name.value };
            all_ws();
            consume("other", "=") || error("No assignment in callback");
            all_ws();
            ret.idlType = return_type();
            all_ws();
            consume("other", "(") || error("No arguments in callback");
            ret["arguments"] = argument_list();
            all_ws();
            consume("other", ")") || error("Unterminated callback");
            all_ws();
            consume("other", ";") || error("Unterminated callback");
            return ret;
        };

        var attribute = function () {
            all_ws();
            var grabbed = []
            ,   ret = {
                type:           "attribute"
            ,   "static":       false
            ,   stringifier:    false
            ,   inherit:        false
            ,   readonly:       false
            };
            if (consume("identifier", "static")) {
                ret["static"] = true;
                grabbed.push(last_token);
            }
            else if (consume("identifier", "stringifier")) {
                ret.stringifier = true;
                grabbed.push(last_token);
            }
            var w = all_ws();
            if (w) grabbed.push(w);
            if (consume("identifier", "inherit")) {
                if (ret["static"] || ret.stringifier) error("Cannot have a static or stringifier inherit");
                ret.inherit = true;
                grabbed.push(last_token);
                var w = all_ws();
                if (w) grabbed.push(w);
            }
            if (consume("identifier", "readonly")) {
                ret.readonly = true;
                grabbed.push(last_token);
                var w = all_ws();
                if (w) grabbed.push(w);
            }
            if (!consume("identifier", "attribute")) {
                tokens = grabbed.concat(tokens);
                return;
            }
            all_ws();
            ret.idlType = type() || error("No type in attribute");
            all_ws();
            var name = consume("identifier") || error("No name in attribute");
            ret.name = name.value;
            all_ws();
            consume("other", ";") || error("Unterminated attribute");
            return ret;
        };
        
        var return_type = function () {
            var typ = type();
            if (!typ) {
                if (consume("identifier", "void")) {
                    return "void";
                }
                else error("No return type");
            }
            return typ;
        };
        
        var operation = function () {
            all_ws();
            var ret = {
                type:           "operation"
            ,   getter:         false
            ,   setter:         false
            ,   creator:        false
            ,   deleter:        false
            ,   legacycaller:   false
            ,   "static":       false
            ,   stringifier:    false
            };
            while (true) {
                all_ws();
                if (consume("identifier", "getter")) ret.getter = true;
                else if (consume("identifier", "setter")) ret.setter = true;
                else if (consume("identifier", "creator")) ret.creator = true;
                else if (consume("identifier", "deleter")) ret.deleter = true;
                else if (consume("identifier", "legacycaller")) ret.legacycaller = true;
                else break;
            }
            if (ret.getter || ret.setter || ret.creator || ret.deleter || ret.legacycaller) {
                all_ws();
                ret.idlType = return_type();
                operation_rest(ret);
                return ret;
            }
            if (consume("identifier", "static")) {
                ret["static"] = true;
                ret.idlType = return_type();
                operation_rest(ret);
                return ret;
            }
            else if (consume("identifier", "stringifier")) {
                ret.stringifier = true;
                all_ws();
                if (consume("other", ";")) return ret;
                ret.idlType = return_type();
                operation_rest(ret);
                return ret;
            }
            ret.idlType = return_type();
            all_ws();
            if (consume("identifier", "iterator")) {
                all_ws();
                ret.type = "iterator";
                if (consume("identifier", "object")) {
                    ret.iteratorObject = "object";
                }
                else if (consume("other", "=")) {
                    all_ws();
                    var name = consume("identifier") || error("No right hand side in iterator");
                    ret.iteratorObject = name.value;
                }
                all_ws();
                consume("other", ";") || error("Unterminated iterator");
            }
            else {
                operation_rest(ret);
                return ret;
            }
        };
        
        var identifiers = function (arr) {
            while (true) {
                all_ws();
                if (consume("other", ",")) {
                    all_ws();
                    var name = consume("identifier") || error("Trailing comma in identifiers list");
                    arr.push(name.value);
                }
                else break;
            }
        };
        
        var serialiser = function () {
            all_ws();
            if (!consume("identifier", "serializer")) return;
            var ret = { type: "serializer" };
            all_ws();
            if (consume("other", "=")) {
                all_ws();
                if (consume("other", "{")) {
                    ret.patternMap = true;
                    all_ws();
                    var id = consume("identifier");
                    if (id && id.value === "getter") {
                        ret.names = ["getter"];
                    }
                    else if (id && id.value === "inherit") {
                        ret.names = ["inherit"];
                        identifiers(ret.names);
                    }
                    else if (id) {
                        ret.names = [id.value];
                        identifiers(ret.names);
                    }
                    else {
                        ret.names = [];
                    }
                    all_ws();
                    consume("other", "}") || error("Unterminated serializer pattern map");
                }
                else if (consume("other", "[")) {
                    ret.patternList = true;
                    all_ws();
                    var id = consume("identifier");
                    if (id && id.value === "getter") {
                        ret.names = ["getter"];
                    }
                    else if (id) {
                        ret.names = [id.value];
                        identifiers(ret.names);
                    }
                    else {
                        ret.names = [];
                    }
                    all_ws();
                    consume("other", "]") || error("Unterminated serializer pattern list");
                }
                else {
                    var name = consume("identifier") || error("Invalid serializer");
                    ret.name = name.value;
                }
                all_ws();
                consume("other", ";") || error("Unterminated serializer");
                return ret;
            }
            else if (consume("other", ";")) {
                // noop, just parsing
            }
            else {
                ret.operation = operation_rest();
            }
            return ret;
        };
        
        var interface_ = function (isPartial) {
            all_ws();
            if (!consume("identifier", "interface")) return;
            all_ws();
            var name = consume("identifier") || error("No name for interface");
            var ret = {
                type:   "interface"
            ,   name:   name.value
            ,   partial:    false
            ,   members:    []
            };
            if (!isPartial) ret.inheritance = inheritance() || null;
            all_ws();
            consume("other", "{") || error("Bodyless interface");
            while (true) {
                all_ws();
                if (consume("other", "}")) {
                    all_ws();
                    consume("other", ";") || error("Missing semicolon after interface");
                    return ret;
                }
                var ea = extended_attrs();
                all_ws();
                var cnt = const_();
                if (cnt) {
                    cnt.extAttrs = ea;
                    ret.members.push(cnt);
                    continue;
                }
                var mem = serialiser() || attribute() || operation() || error("Unknown member");
                mem.extAttrs = ea;
                ret.members.push(mem);
            }
        };
        
        var partial = function () {
            all_ws();
            if (!consume("identifier", "partial")) return;
            var thing = dictionary(true) || interface_(true) || error("Partial doesn't apply to anything");
            thing.partial = true;
            return thing;
        };
        
        var dictionary = function (isPartial) {
            all_ws();
            if (!consume("identifier", "dictionary")) return;
            all_ws();
            var name = consume("identifier") || error("No name for dictionary");
            var ret = {
                type:   "dictionary"
            ,   name:   name.value
            ,   partial:    false
            ,   members:    []
            };
            if (!isPartial) ret.inheritance = inheritance() || null;
            all_ws();
            consume("other", "{") || error("Bodyless dictionary");
            while (true) {
                all_ws();
                if (consume("other", "}")) {
                    all_ws();
                    consume("other", ";") || error("Missing semicolon after dictionary");
                    return ret;
                }
                var ea = extended_attrs();
                all_ws();
                var typ = type() || error("No type for dictionary member");
                all_ws();
                var name = consume("identifier") || error("No name for dictionary member");
                ret.members.push({
                    type:       "field"
                ,   name:       name.value
                ,   idlType:    typ
                ,   extAttrs:   ea
                ,   "default":  default_()
                });
                all_ws();
                consume("other", ";") || error("Unterminated dictionary member");
            }
        };
        
        var exception = function () {
            all_ws();
            if (!consume("identifier", "exception")) return;
            all_ws();
            var name = consume("identifier") || error("No name for exception");
            var ret = {
                type:   "exception"
            ,   name:   name.value
            ,   members:    []
            };
            ret.inheritance = inheritance() || null;
            all_ws();
            consume("other", "{") || error("Bodyless exception");
            while (true) {
                all_ws();
                if (consume("other", "}")) {
                    all_ws();
                    consume("other", ";") || error("Missing semicolon after exception");
                    return ret;
                }
                var ea = extended_attrs();
                all_ws();
                var cnt = const_();
                if (cnt) {
                    cnt.extAttrs = ea;
                    ret.members.push(cnt);
                }
                else {
                    var typ = type();
                    all_ws();
                    var name = consume("identifier");
                    all_ws();
                    if (!typ || !name || !consume("other", ";")) error("Unknown member in exception body");
                    ret.members.push({
                        type:       "field"
                    ,   name:       name.value
                    ,   idlType:    typ
                    ,   extAttrs:   ea
                    });
                }
            }
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
            ret.extAttrs = extended_attrs();
            all_ws();
            ret.idlType = type() || error("No type in typedef");
            all_ws();
            var name = consume("identifier") || error("No name in typedef");
            ret.name = name.value;
            all_ws();
            consume("other", ";") || error("Unterminated typedef");
            return ret;
        };
        
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
                var ea = extended_attrs()
                ,   def = definition();
                if (!def) {
                    if (ea.length) error("Stray extended attributes");
                    break;
                }
                def.extAttrs = ea;
                defs.push(def);
            }
            return defs;
        };
        
        return definitions();
    };

    var obj = {
        parse:  function (str) {
            var tokens = tokenise(str);
            // console.log(tokens);
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
