"use strict";

(() => {
  function error(source, token, current, str) {
    const consume_position = token.index;
    const maxTokens = 5;
    const line =
      !source[token.index].type === "eof" ? source[consume_position].line :
      source.length > 1 ? source[consume_position - 1].line :
      1;

    const precedingLine = lastLine(
      tokensToText(sliceTokens(-maxTokens), { precedes: true })
    );

    const procedingTokens = sliceTokens(maxTokens);
    const procedingText = tokensToText(procedingTokens);
    const procedingLine = procedingText.split("\n")[0];

    const spaced = " ".repeat(precedingLine.length) + "^ " + str;
    const context = precedingLine + procedingLine + "\n" + spaced;

    const inside = current ? `, inside \`${current.partial ? "partial " : ""}${current.type} ${current.name}\`` : "";
    return `Validation error at line ${line}${inside}:\n${context}`;

    function sliceTokens(count) {
      return count > 0 ?
        source.slice(consume_position, consume_position + count) :
        source.slice(Math.max(consume_position + count, 0), consume_position);
    }

    function tokensToText(inputs, { precedes } = {}) {
      const text = inputs.map(t => t.trivia + t.value).join("");
      const nextToken = source[consume_position];
      if (nextToken.type === "eof") {
        return text;
      }
      if (precedes) {
        return text + nextToken.trivia;
      }
      return text.slice(nextToken.trivia.length);
    }

    function lastLine(text) {
      const splitted = text.split("\n");
      return splitted[splitted.length - 1];
    }
  }

  function* nameDuplicationCheck(defs) {
    const unique = new Map();
    const dups = new Set();
    for (const def of defs) {
      if (def.partial || !def.name) {
        continue;
      }
      if (!unique.has(def.name)) {
        unique.set(def.name, def);
      } else {
        dups.add(def);
      }
    }

    for (const dup of dups) {
      const { name } = dup;
      const message = `The name "${name}" of type "${unique.get(name).type}" was already seen`;
      yield error(dup.source, dup.tokens.name, dup, message);
    }
  }

  function validate(defs) {
    return [
      ...nameDuplicationCheck(defs)
    ];
  }

  const obj = {
    validate
  };

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = obj;
  } else if (typeof define === 'function' && define.amd) {
    define([], () => obj);
  } else {
    (self || window).WebIDL2Validator = obj;
  }
})();
