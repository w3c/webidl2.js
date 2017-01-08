//@flow

(function () {
    function tokenise(str /* : string */) /* : Array<Token> */ {
        var tokens = []
        ,   re = {
                "float":        /^-?(([0-9]+\.[0-9]*|[0-9]*\.[0-9]+)([Ee][-+]?[0-9]+)?|[0-9]+[Ee][-+]?[0-9]+)/
            ,   "integer":      /^-?(0([Xx][0-9A-Fa-f]+|[0-7]*)|[1-9][0-9]*)/
            ,   "identifier":   /^[A-Z_a-z][0-9A-Z_a-z-]*/
            ,   "string":       /^"[^"]*"/
            ,   "whitespace":   /^(?:[\t\n\r ]+|[\t\n\r ]*((\/\/.*|\/\*(.|\n|\r)*?\*\/)[\t\n\r ]*))+/
            ,   "other":        /^[^\t\n\r 0-9A-Z_a-z]/
            }
        ;
        while (str) {
            var matched = Object.keys(re).some(function(type) {
                var matched = false;

                str = str.replace(re[type], function (tok) {
                    tokens.push({ type: type, value: tok });
                    matched = true;
                    return "";
                });

                return matched;
            });

            if (!matched) {
                throw new Error("Token stream not progressing");
            }
        }
        return tokens;
    };

    function WebIDLParseError(str /* : string */, line /* : number */, input /* : string */, tokens /* : Array<Token> */) {
      this.message = str;
      this.line = line;
      this.input = input;
      this.tokens = tokens;
    };

    //$FlowFixMe: Flow doesn't handle ES5-style clases very well.
    WebIDLParseError.prototype.toString = function() {
      return this.message + ", line " + this.line + " (tokens: '" + this.input + "')\n" +
        JSON.stringify(this.tokens, null, 4);
    };

    function parse(tokens /* : Array<Token> */, opt /* : ParseOptions */) {
        var line = 1;
        tokens = tokens.slice();

        var FLOAT = "float"
        ,   INT = "integer"
        ,   ID = "identifier"
        ,   STR = "string"
        ,   OTHER = "other"
        ;

        function error(str /* : string */) {
            var last5 = tokens.slice(0, 5);
            var tok = last5.reduce(function(tok, token) {
                return tok + token.value;
            }, "");
            throw new WebIDLParseError(str, line, tok, last5);
        };

        var last_token = null;

        function consume(type /* : TokenType */, value /* : ?string */) /* : ?Token */ {
            if (tokens[0] && tokens[0].type === type && (typeof value === "undefined" || tokens[0].value === value)) {
                 last_token = tokens.shift();
                 if (type === ID) last_token.value = last_token.value.replace(/^_/, "");
                 return last_token;
             }
        };

        function ws() /* : ?Token */ {
            if (tokens[0] && tokens[0].type === "whitespace") {
                var t = tokens.shift();
                t.value.replace(/\n/g, function (m) { line++; return m; });
                return t;
            }
        };

        function all_ws() /* : ?Token */ {
            var token = { type: "whitespace", value: "" };
            for (var wsToken = ws(); wsToken; wsToken = ws()) {
                token.value += wsToken.value;
            }
            if (token.value) {
                return token;
            }
        };

        // TODO(mroberts): Refactor so that Flow can infer IntegerType.
        function integer_type() /* : ?string */ {
            var ret = "";
            all_ws();
            if (consume(ID, "unsigned")) ret = "unsigned ";
            all_ws();
            if (consume(ID, "short")) return ret + "short";
            if (consume(ID, "long")) {
                ret += "long";
                all_ws();
                if (consume(ID, "long")) return ret + " long";
                return ret;
            }
            if (ret) error("Failed to parse integer type");
        };

        function float_type() /* ?FloatType */ {
            var ret = "";
            all_ws();
            if (consume(ID, "unrestricted")) ret = "unrestricted ";
            all_ws();
            if (consume(ID, "float")) return ret + "float";
            if (consume(ID, "double")) return ret + "double";
            if (ret) error("Failed to parse float type");
        };

        function primitive_type() /* : ?PrimitiveType */ {
            var num_type = integer_type() || float_type();
            if (num_type) {
                // NOTE(mroberts): Flow can't infer that integer_type really
                // does return an IntegerType value (when it returns at all).
                //$FlowFixMe: See note above.
                return num_type;
            }
            all_ws();
            if (consume(ID, "boolean")) return "boolean";
            if (consume(ID, "byte")) return "byte";
            if (consume(ID, "octet")) return "octet";
        };

        function const_value() /* : ?IDLValue */ {
            if (consume(ID, "true")) return { type: "boolean", value: true };
            if (consume(ID, "false")) return { type: "boolean", value: false };
            if (consume(ID, "null")) return { type: "null" };
            if (consume(ID, "Infinity")) return { type: "Infinity", negative: false };
            if (consume(ID, "NaN")) return { type: "NaN" };
            var ret = consume(FLOAT) || consume(INT);
            if (ret) return { type: "number", value: Number(ret.value) };
            var tok = consume(OTHER, "-");
            if (tok) {
                if (consume(ID, "Infinity")) return { type: "Infinity", negative: true };
                else tokens.unshift(tok);
            }
        };

        function type_suffix(obj /* : IDLType */) /* : void */ {
            var token;
            do {
                all_ws();
                if (token = consume(OTHER, "?")) {
                    if (obj.nullable) error("Can't nullable more than once");
                    obj.nullable = true;
                }
                else if (token = consume(OTHER, "[")) {
                    all_ws();
                    consume(OTHER, "]") || error("Unterminated array type");
                    if (!obj.array) {
                        obj.array = 1;
                        obj.nullableArray = [obj.nullable];
                    }
                    else {
                        if (typeof obj.array === 'boolean') {
                            obj.array = Number(obj.array);
                        }
                        obj.array++;
                        // NOTE(mroberts): An IDLType's array property is always
                        // initialized to false and only ever becomes non-false
                        // in the if-statement above, after which this else-
                        // statement begins to fire. Since the IDLType's
                        // nullableArray property is initialize above, we can
                        // be sure it's an Array below.
                        //$FlowFixMe: See note above.
                        obj.nullableArray.push(obj.nullable);
                    }
                    obj.nullable = false;
                }
            } while (token);
        };

        function single_type() /* : ?IDLType */ {
            var ret = {};
            ret.sequence = false;
            ret.generic = null;
            ret.nullable = false;
            ret.array = false;
            ret.union = false;

            var prim = primitive_type()
            ,   name
            ,   value
            ;
            if (prim) {
                ret.idlType = prim;
            }
            else if (name = consume(ID)) {
                value = name.value;
                all_ws();
                // Generic types
                if (consume(OTHER, "<")) {
                    // backwards compat
                    if (value === "sequence") {
                        ret.sequence = true;
                    }
                    ret.generic = value;
                    ret.idlType = type() || error("Error parsing generic type " + value);
                    all_ws();
                    if (!consume(OTHER, ">")) error("Unterminated generic type " + value);
                    type_suffix(ret);
                    return ret;
                }
                else {
                    ret.idlType = value;
                }
            }
            else {
                return;
            }
            type_suffix(ret);
            if (ret.nullable && !ret.array && ret.idlType === "any") error("Type any cannot be made nullable");
            return ret;
        };

        function union_type() /* : ?IDLType */ {
            var ret = {};
            ret.sequence = false;
            ret.generic = null;
            ret.nullable = false;
            ret.array = false;
            ret.union = true;
            ret.idlType = [];

            all_ws();
            if (!consume(OTHER, "(")) return;
            var fst = type() || error("Union type with no content");
            ret.idlType.push(fst);
            for (all_ws(); consume(ID, "or"); all_ws()) {
                var typ = type() || error("No type after 'or' in union type");
                ret.idlType.push(typ);
            }
            if (!consume(OTHER, ")")) error("Unterminated union type");
            type_suffix(ret);
            return ret;
        };

        function type() /* : ?IDLType */ {
            return single_type() || union_type();
        };

        function argument() /* : ?IDLArgument */ {
            var ret = {};
            ret.optional = false;
            ret.variadic = false;
            ret.extAttrs = extended_attrs();

            all_ws();
            var opt_token = consume(ID, "optional");
            if (opt_token) {
                ret.optional = true;
                all_ws();
            }
            var idlType = type();
            if (!idlType) {
                if (opt_token) tokens.unshift(opt_token);
                return;
            }
            ret.idlType = idlType;
            // NOTE(mroberts): last_token is initialized to null; however, once
            // we've successfully consumed a token, it becomes and remains
            // non-null. The way this library is currently structured, only
            // argument_list calls out to this function; and all calls to
            // argument_list are preceded by consuming a token. Therefore we can
            // can be sure last_token is non-null here.
            //$FlowFixMe: See note above.
            var type_token /* : Object */ = last_token;
            if (!ret.optional) {
                all_ws();
                if (tokens[0] && tokens[0].type === "other" && tokens[0].value === "." &&
                    tokens[1] && tokens[1].type === "other" && tokens[1].value === "." &&
                    tokens[2] && tokens[2].type === "other" && tokens[2].value === "."
                    ) {
                    tokens.shift();
                    tokens.shift();
                    tokens.shift();
                    ret.variadic = true;
                }
            }
            all_ws();
            var name = consume(ID);
            if (!name) {
                if (opt_token) tokens.unshift(opt_token);
                tokens.unshift(type_token);
                return;
            }
            ret.name = name.value;
            if (ret.optional) {
                all_ws();
                var dflt = default_();
                if (dflt) {
                    ret.default = dflt;
                }
            }
            return ret;
        };

        function argument_list() /* : ?Array<IDLArgument> */ {
            var ret = []
            ,   arg = argument()
            ;
            if (!arg) return;
            ret.push(arg);
            for (all_ws(); consume(OTHER, ","); all_ws()) {
                var nxt = argument() || error("Trailing comma in arguments list");
                ret.push(nxt);
            }
            return ret;
        };

        function type_pair() /* : ?[IDLType, IDLType] */ {
            all_ws();
            var k = type();
            if (!k) return;
            all_ws()
            if (!consume(OTHER, ",")) return;
            all_ws();
            var v = type();
            if (!v) return;
            return [k, v];
        };

        function simple_extended_attr() /* : ?IDLExtendedAttribute */ {
            var ret = {};
            ret.arguments = null;

            all_ws();
            var name = consume(ID);
            if (!name) return;
            ret.name = name.value;
            all_ws();
            var eq = consume(OTHER, "=");
            if (eq) {
                var rhs;
                all_ws();
                if (rhs = consume(ID)) {
                  ret.rhs = { type: "identifier", value: rhs.value };
                }
                else if (rhs = consume(FLOAT)) {
                  ret.rhs = { type: "float", value: rhs.value };
                }
                else if (rhs = consume(INT)) {
                  ret.rhs = { type: "integer", value: rhs.value };
                }
                else if (rhs = consume(STR)) {
                  ret.rhs = { type: "string", value: rhs.value };
                }
                else if (consume(OTHER, "(")) {
                    // [Exposed=(Window,Worker)]
                    rhs = [];
                    var id = consume(ID);
                    if (id) {
                      rhs = [id.value];
                    }
                    rhs = rhs.concat(identifiers());
                    consume(OTHER, ")") || error("Unexpected token in extended attribute argument list or type pair");
                    ret.rhs = {
                        type: "identifier-list",
                        value: rhs
                    };
                }
                if (!ret.rhs) return error("No right hand side to extended attribute assignment");
            }
            all_ws();
            if (consume(OTHER, "(")) {
                var args, pair;
                // [Constructor(DOMString str)]
                if (args = argument_list()) {
                    ret["arguments"] = args;
                }
                // [MapClass(DOMString, DOMString)]
                else if (pair = type_pair()) {
                    ret.typePair = pair;
                }
                // [Constructor()]
                else {
                    ret["arguments"] = [];
                }
                all_ws();
                consume(OTHER, ")") || error("Unexpected token in extended attribute argument list or type pair");
            }
            return ret;
        };

        // Note: we parse something simpler than the official syntax. It's all that ever
        // seems to be used
        function extended_attrs() /* : Array<IDLExtendedAttribute> */ {
            var eas = [];
            all_ws();
            if (!consume(OTHER, "[")) return eas;
            eas[0] = simple_extended_attr() || error("Extended attribute with not content");
            all_ws();
            while (consume(OTHER, ",")) {
                eas.push(simple_extended_attr() || error("Trailing comma in extended attribute"));
                all_ws();
            }
            consume(OTHER, "]") || error("No end of extended attribute");
            return eas;
        };

        function default_() /* : ?IDLValue */ {
            all_ws();
            if (consume(OTHER, "=")) {
                all_ws();
                var def = const_value();
                if (def) {
                    return def;
                }
                else if (consume(OTHER, "[")) {
                    if (!consume(OTHER, "]")) error("Default sequence value must be empty");
                    return { type: "sequence", value: [] };
                }
                else {
                    var str = consume(STR) || error("No value for default");
                    str.value = str.value.replace(/^"/, "").replace(/"$/, "");
                    return { type: "string", value: str.value };
                }
            }
        };

        function const_(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLConstantMember */ {
            var ret = {};
            ret.type = "const";
            ret.nullable = false;
            ret.extAttrs = ea;

            all_ws();
            if (!consume(ID, "const")) return;
            all_ws();
            var typ = primitive_type();
            if (!typ) {
                typ = consume(ID) || error("No type for const");
                typ = typ.value;
            }
            ret.idlType = typ;
            all_ws();
            if (consume(OTHER, "?")) {
                ret.nullable = true;
                all_ws();
            }
            var name = consume(ID) || error("No name for const");
            ret.name = name.value;
            all_ws();
            consume(OTHER, "=") || error("No value assignment for const");
            all_ws();
            var cnt = const_value();
            if (cnt) ret.value = cnt;
            else error("No value for const");
            all_ws();
            consume(OTHER, ";") || error("Unterminated const");
            return ret;
        };

        function inheritance() /* : ?string */ {
            all_ws();
            if (consume(OTHER, ":")) {
                all_ws();
                var inh = consume(ID) || error ("No type in inheritance");
                return inh.value;
            }
        };

        function operation_rest() /* : { name: ?string, arguments: Array<IDLArgument> } */ {
            all_ws();
            var name = consume(ID);
            all_ws();
            consume(OTHER, "(") || error("Invalid operation");
            var args = argument_list() || [];
            all_ws();
            consume(OTHER, ")") || error("Unterminated operation");
            all_ws();
            consume(OTHER, ";") || error("Unterminated operation");
            return { name: name ? name.value : null, arguments: args };
        };

        function callback(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLCallback|IDLCallbackInterface */ {
            all_ws();
            if (!consume(ID, "callback")) return;
            all_ws();
            var tok = consume(ID, "interface");
            if (tok) {
                tokens.unshift(tok);
                // NOTE(mroberts): Flow thinks ret could become undefined here;
                // but we've already confirmed the next token is "interface".
                // Therefore, interface_ will not return undefined; however, it
                // may throw on a parse error. So if we make it here, we can be
                // sure ret is not undefined.
                //$FlowFixMe: See note above.
                var iface /* : IDLInterface */ = interface_(false, ea);
                return {
                    type: "callback interface",
                    name: iface.name,
                    partial: iface.partial,
                    members: iface.members,
                    inheritance: iface.inheritance,
                    extAttrs: ea
                };
            }
            var name = consume(ID) || error("No name for callback");
            all_ws();
            consume(OTHER, "=") || error("No assignment in callback");
            all_ws();
            var returnType = return_type() || error("No return type in callback");
            all_ws();
            consume(OTHER, "(") || error("No arguments in callback");
            var args = argument_list() || [];
            all_ws();
            consume(OTHER, ")") || error("Unterminated callback");
            all_ws();
            consume(OTHER, ";") || error("Unterminated callback");
            if (returnType === 'string') error('foo');
            return {
                type: "callback",
                name: name.value,
                idlType: returnType,
                arguments: args,
                extAttrs: ea
            };
        };

        function attribute(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLAttributeMember */ {
            var ret = {};
            ret.type = "attribute";
            ret.static = false;
            ret.stringifier = false;
            ret.inherit = false;
            ret.readonly = false;
            ret.extAttrs = ea;

            all_ws();
            var grabbed = [];
            if (consume(ID, "static")) {
                ret["static"] = true;
                // NOTE(mroberts): last_token is initialized to null; however,
                // once we've successfully consumed a token, it becomes and
                // remains non-null. Therefore, we can be sure last_token is
                // non-null here.
                //$FlowFixMe: See note above.
                grabbed.push(last_token);
            }
            else if (consume(ID, "stringifier")) {
                ret.stringifier = true;
                // NOTE(mroberts): last_token is initialized to null; however,
                // once we've successfully consumed a token, it becomes and
                // remains non-null. Therefore, we can be sure last_token is
                // non-null here.
                //$FlowFixMe: See note above.
                grabbed.push(last_token);
            }
            var w = all_ws();
            if (w) grabbed.push(w);
            if (consume(ID, "inherit")) {
                if (ret["static"] || ret.stringifier) error("Cannot have a static or stringifier inherit");
                ret.inherit = true;
                // NOTE(mroberts): last_token is initialized to null; however,
                // once we've successfully consumed a token, it becomes and
                // remains non-null. Therefore, we can be sure last_token is
                // non-null here.
                //$FlowFixMe: See note above.
                grabbed.push(last_token);
                var w = all_ws();
                if (w) grabbed.push(w);
            }
            if (consume(ID, "readonly")) {
                ret.readonly = true;
                // NOTE(mroberts): last_token is initialized to null; however,
                // once we've successfully consumed a token, it becomes and
                // remains non-null. Therefore, we can be sure last_token is
                // non-null here.
                //$FlowFixMe: See note above.
                grabbed.push(last_token);
                var w = all_ws();
                if (w) grabbed.push(w);
            }
            if (!consume(ID, "attribute")) {
                tokens = grabbed.concat(tokens);
                return;
            }
            all_ws();
            ret.idlType = type() || error("No type in attribute");
            if (ret.idlType.sequence) error("Attributes cannot accept sequence types");
            all_ws();
            var name = consume(ID) || error("No name in attribute");
            ret.name = name.value;
            all_ws();
            consume(OTHER, ";") || error("Unterminated attribute");
            return ret;
        };

        function return_type() /* : ?IDLType|"void" */ {
            var typ = type();
            if (!typ) {
                if (consume(ID, "void")) {
                    return "void";
                }
                else error("No return type");
            }
            return typ;
        };

        function operation(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLIteratorMember|IDLOperationMember */ {
            var ret = {};
            ret.type = "operation";
            ret.getter = false;
            ret.setter = false;
            ret.creator = false;
            ret.deleter = false;
            ret.legacycaller = false;
            ret.static = false;
            ret.stringifier = false;
            ret.extAttrs = ea;

            all_ws();
            var token;
            do {
                all_ws();
                if (token = consume(ID, "getter")) ret.getter = true;
                else if (token = consume(ID, "setter")) ret.setter = true;
                else if (token = consume(ID, "creator")) ret.creator = true;
                else if (token = consume(ID, "deleter")) ret.deleter = true;
                else if (token = consume(ID, "legacycaller")) ret.legacycaller = true;
            } while (token);
            if (ret.getter || ret.setter || ret.creator || ret.deleter || ret.legacycaller) {
                all_ws();
                var returnType = return_type();
                if (returnType) {
                    ret.idlType = returnType;
                }
                var rest = operation_rest(ret);
                ret.name = rest.name;
                ret.arguments = rest.arguments;
                return (ret /* : IDLOperationMember */);
            }
            if (consume(ID, "static")) {
                ret["static"] = true;
                var returnType = return_type();
                if (returnType) {
                    ret.idlType = returnType;
                }
                var rest = operation_rest(ret);
                ret.name = rest.name;
                ret.arguments = rest.arguments;
                return (ret /* : IDLOperationMember */);
            }
            else if (consume(ID, "stringifier")) {
                ret.stringifier = true;
                all_ws();
                if (consume(OTHER, ";")) return (ret /* : IDLOperationMember */);
                var returnType = return_type();
                if (returnType) {
                    ret.idlType = returnType;
                }
                var rest = operation_rest(ret);
                ret.name = rest.name;
                ret.arguments = rest.arguments;
                return (ret /* : IDLOperationMember */);
            }
            var returnType = return_type();
            if (returnType) {
                ret.idlType = returnType;
            }
            all_ws();
            if (consume(ID, "iterator")) {
                all_ws();
                var iteratorObject;
                if (consume(ID, "object")) {
                    iteratorObject = "object";
                }
                else if (consume(OTHER, "=")) {
                    all_ws();
                    var name = consume(ID) || error("No right hand side in iterator");
                    iteratorObject = name.value;
                }
                all_ws();
                consume(OTHER, ";") || error("Unterminated iterator");

                var iteratorMember = {};
                iteratorMember.type = "iterator";
                iteratorMember.getter = ret.getter;
                iteratorMember.setter = ret.setter;
                iteratorMember.creator = ret.creator;
                iteratorMember.deleter = ret.deleter;
                iteratorMember.legacycaller = ret.legacycaller;
                iteratorMember.static = ret.static;
                iteratorMember.stringifier = ret.stringifier;
                iteratorMember.idlType = ret.idlType;
                if (iteratorObject) {
                    iteratorMember.iteratorObject = iteratorObject;
                }
                iteratorMember.extAttrs = ret.extAttrs;
                return iteratorMember;
            }
            else {
                var rest = operation_rest(ret);
                ret.name = rest.name;
                ret.arguments = rest.arguments;
                return (ret /* : IDLOperationMember */);
            }
        };

        function identifiers() /* : Array<string> */ {
            var arr = [];
            for (all_ws(); consume(OTHER, ","); all_ws()) {
                all_ws();
                var name = consume(ID) || error("Trailing comma in identifiers list");
                arr.push(name.value);
            }
            return arr;
        };

        function serialiser(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLNamedSerializerMember|IDLSerializerMember|IDLSerializerOperationMember|IDLSerializerPatternListMember|IDLSerializerPatternMapMember */ {
            var ret = {};
            ret.type = "serializer";
            ret.extAttrs = ea;

            all_ws();
            if (!consume(ID, "serializer")) return;
            all_ws();
            if (consume(OTHER, "=")) {
                all_ws();
                if (consume(OTHER, "{")) {
                    ret.patternMap = true;
                    all_ws();
                    var id = consume(ID);
                    if (id && id.value === "getter") {
                        ret.names = ["getter"];
                    }
                    else if (id && id.value === "inherit") {
                        ret.names = ["inherit"].concat(identifiers());
                    }
                    else if (id) {
                        ret.names = [id.value].concat(identifiers());
                    }
                    else {
                        ret.names = [];
                    }
                    all_ws();
                    consume(OTHER, "}") || error("Unterminated serializer pattern map");
                }
                else if (consume(OTHER, "[")) {
                    ret.patternList = true;
                    all_ws();
                    var id = consume(ID);
                    if (id && id.value === "getter") {
                        ret.names = ["getter"];
                    }
                    else if (id) {
                        ret.names = [id.value].concat(identifiers());
                    }
                    else {
                        ret.names = [];
                    }
                    all_ws();
                    consume(OTHER, "]") || error("Unterminated serializer pattern list");
                }
                else {
                    var name = consume(ID) || error("Invalid serializer");
                    ret.name = name.value;
                }
                all_ws();
                consume(OTHER, ";") || error("Unterminated serializer");
                //$FlowFixMe: Refactor so that Flow can typecheck this more easily.
                return ret;
            }
            else if (consume(OTHER, ";")) {
                // noop, just parsing
            }
            else {
                ret.idlType = return_type();
                all_ws();
                ret.operation = operation_rest();
            }
            //$FlowFixMe: Refactor so that Flow can typecheck this more easily.
            return ret;
        };

        function iterable_type() /* : ?IterableType */ {
            if (consume(ID, "iterable")) return "iterable";
            else if (consume(ID, "legacyiterable")) return "legacyiterable";
            else if (consume(ID, "maplike")) return "maplike";
            else if (consume(ID, "setlike")) return "setlike";
        }

        function readonly_iterable_type() /* : ?ReadonlyIterableType */ {
            if (consume(ID, "maplike")) return "maplike";
            else if (consume(ID, "setlike")) return "setlike";
        }

        function iterable(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLIterableMember|IDLLegacyIterableMember|IDLMaplikeMember|IDLSetlikeMember */ {
            var ret = {};
            ret.type = null;
            ret.idlType = null;
            ret.readonly = false;
            ret.extAttrs = ea;

            all_ws();
            var grabbed = [];
            if (consume(ID, "readonly")) {
                ret.readonly = true;
                // NOTE(mroberts): last_token is initialized to null; however,
                // once we've successfully consumed a token, it becomes and
                // remains non-null. Therefore, we can be sure last_token is
                // non-null here.
                //$FlowFixMe: See note above.
                grabbed.push(last_token);
                var w = all_ws();
                if (w) grabbed.push(w);
            }
            var consumeItType = ret.readonly ? readonly_iterable_type : iterable_type;

            var ittype = consumeItType();
            if (!ittype) {
                tokens = grabbed.concat(tokens);
                return;
            }

            var secondTypeRequired = ittype === "maplike";
            var secondTypeAllowed = secondTypeRequired || ittype === "iterable";
            ret.type = ittype;
            if (ret.type !== 'maplike' && ret.type !== 'setlike')
                delete ret.readonly;
            all_ws();
            if (consume(OTHER, "<")) {
                ret.idlType = type() || error("Error parsing " + ittype + " declaration");
                all_ws();
                if (secondTypeAllowed) {
                    var type2 = null;
                    if (consume(OTHER, ",")) {
                        all_ws();
                        type2 = type();
                        all_ws();
                    }
                    if (type2)
                        ret.idlType = [ret.idlType, type2];
                    else if (secondTypeRequired)
                        error("Missing second type argument in " + ittype + " declaration");
                }
                if (!consume(OTHER, ">")) error("Unterminated " + ittype + " declaration");
                all_ws();
                if (!consume(OTHER, ";")) error("Missing semicolon after " + ittype + " declaration");
            }
            else
                error("Error parsing " + ittype + " declaration");

            //$FlowFixMe: Refactor so that Flow can typecheck this more easily.
            return ret;
        }

        function interface_(isPartial, ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLInterface */ {
            var ret = {};
            ret.type = "interface";
            ret.partial = false;
            ret.members = [];
            ret.extAttrs = ea;

            all_ws();
            if (!consume(ID, "interface")) return;
            all_ws();
            var name = consume(ID) || error("No name for interface");
            ret.name = name.value;
            if (!isPartial) ret.inheritance = inheritance() || null;
            all_ws();
            consume(OTHER, "{") || error("Bodyless interface");
            while (true) {
                all_ws();
                if (consume(OTHER, "}")) {
                    all_ws();
                    consume(OTHER, ";") || error("Missing semicolon after interface");
                    return ret;
                }
                var ea = extended_attrs();
                all_ws();
                var cnt = const_(ea);
                if (cnt) {
                    ret.members.push(cnt);
                    continue;
                }
                var mem = (opt.allowNestedTypedefs && typedef(ea)) ||
                          iterable(ea) ||
                          serialiser(ea) ||
                          attribute(ea) ||
                          operation(ea) ||
                          error("Unknown member");
                ret.members.push(mem);
            }
        };

        function partial(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLDictionary|IDLInterface */ {
            all_ws();
            if (!consume(ID, "partial")) return;
            var thing = dictionary(true, ea) ||
                        interface_(true, ea) ||
                        error("Partial doesn't apply to anything");
            thing.partial = true;
            return thing;
        };

        function dictionary(isPartial, ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLDictionary */ {
            var ret = {};
            ret.type = "dictionary";
            ret.partial = false;
            ret.members = [];
            ret.extAttrs = ea;

            all_ws();
            if (!consume(ID, "dictionary")) return;
            all_ws();
            var name = consume(ID) || error("No name for dictionary");
            ret.name = name.value;
            if (!isPartial) ret.inheritance = inheritance() || null;
            all_ws();
            consume(OTHER, "{") || error("Bodyless dictionary");
            while (true) {
                all_ws();
                if (consume(OTHER, "}")) {
                    all_ws();
                    consume(OTHER, ";") || error("Missing semicolon after dictionary");
                    return ret;
                }
                var ea = extended_attrs();
                all_ws();
                var required = consume(ID, "required");
                var typ = type() || error("No type for dictionary member");
                all_ws();
                var name = consume(ID) || error("No name for dictionary member");
                var dflt = default_();
                if (required && dflt) error("Required member must not have a default");

                var member = {};
                member.type = "field";
                member.name = name.value;
                member.required = !!required;
                member.idlType = typ;
                member.extAttrs = ea;

                if (dflt) {
                    member["default"] = dflt;
                }
                ret.members.push(member);
                all_ws();
                consume(OTHER, ";") || error("Unterminated dictionary member");
            }
        };

        function exception(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLException */ {
            var ret = {};
            ret.type = "exception";
            ret.members = [];
            ret.extAttrs = ea;

            all_ws();
            if (!consume(ID, "exception")) return;
            all_ws();
            var name = consume(ID) || error("No name for exception");
            ret.name = name.value;
            ret.inheritance = inheritance() || null;
            all_ws();
            consume(OTHER, "{") || error("Bodyless exception");
            while (true) {
                all_ws();
                if (consume(OTHER, "}")) {
                    all_ws();
                    consume(OTHER, ";") || error("Missing semicolon after exception");
                    return ret;
                }
                var ea = extended_attrs();
                all_ws();
                var cnt = const_(ea);
                if (cnt) {
                    ret.members.push(cnt);
                }
                else {
                    var typ = type();
                    all_ws();
                    var name = consume(ID);
                    all_ws();
                    if (typ && name && consume(OTHER, ";")) {
                        ret.members.push({
                            type:       "field"
                        ,   name:       name.value
                        ,   idlType:    typ
                        ,   extAttrs:   ea
                        });
                    } else {
                        error("Unknown member in exception body");
                    }
                }
            }
        };

        function enum_(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLEnum */ {
            all_ws();
            if (!consume(ID, "enum")) return;
            all_ws();
            var name = consume(ID) || error("No name for enum");
            var vals = []
            ,   ret = {
                type:   "enum"
            ,   name:   name.value
            ,   values: vals
            ,   extAttrs: ea
            };
            all_ws();
            consume(OTHER, "{") || error("No curly for enum");
            var saw_comma = false;
            while (true) {
                all_ws();
                if (consume(OTHER, "}")) {
                    all_ws();
                    consume(OTHER, ";") || error("No semicolon after enum");
                    return ret;
                }
                var val = consume(STR) || error("Unexpected value in enum");
                ret.values.push(val.value.replace(/"/g, ""));
                all_ws();
                if (consume(OTHER, ",")) {
                    all_ws();
                    saw_comma = true;
                }
                else {
                    saw_comma = false;
                }
            }
        };

        function typedef(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLTypedef */ {
            var ret = {};
            ret.type = "typedef";
            ret.extAttrs = ea;

            all_ws();
            if (!consume(ID, "typedef")) return;
            all_ws();
            ret.typeExtAttrs = extended_attrs();
            all_ws();
            ret.idlType = type() || error("No type in typedef");
            all_ws();
            var name = consume(ID) || error("No name in typedef");
            ret.name = name.value;
            all_ws();
            consume(OTHER, ";") || error("Unterminated typedef");
            return ret;
        };

        function implements_(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLImplements */ {
            all_ws();
            var target = consume(ID);
            if (!target) return;
            var w = all_ws();
            if (consume(ID, "implements")) {
                var ret = {};
                ret.type = "implements";
                ret.target = target.value;
                ret.extAttrs = ea;

                all_ws();
                var imp = consume(ID) || error("Incomplete implements statement");
                ret["implements"] = imp.value;
                all_ws();
                consume(OTHER, ";") || error("No terminating ; for implements statement");
                return ret;
            }
            else {
                // rollback
                if (w) {
                    tokens.unshift(w);
                }
                tokens.unshift(target);
            }
        };

        function definition(ea /* : Array<IDLExtendedAttribute> */) /* : ?IDLDefinition */ {
            return  callback(ea)          ||
                    interface_(false, ea) ||
                    partial(ea)           ||
                    dictionary(false, ea) ||
                    exception(ea)         ||
                    enum_(ea)             ||
                    typedef(ea)           ||
                    implements_(ea)
                    ;
        };

        function definitions() /* : Array<IDLDefinition> */ {
            if (!tokens.length) return [];
            var defs = [];
            var ea;
            var def;
            for (ea = extended_attrs(), def = definition(ea); def;
                 ea = extended_attrs(), def = definition(ea)) {
                defs.push(def);
            }
            if (ea.length) error("Stray extended attributes");
            return defs;
        };
        var res = definitions();
        if (tokens.length) error("Unrecognised tokens");
        return res;
    };

    var obj = {
      parse: function(str /* : string */, opt /* : ?ParseOptions */) /* : Array<IDLDefinition> */ {
        if (!opt) opt = {};
        var tokens = tokenise(str);
        return parse(tokens, opt);
      }
    };

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
      module.exports = obj;
    //$FlowFixMe: Flow doesn't know that this code could run in an AMD environment.
    } else if (typeof define === 'function' && define.amd) {
      define([], function(){
        return obj;
      });
    } else {
      (self || window).WebIDL2 = obj;
    }
}());
