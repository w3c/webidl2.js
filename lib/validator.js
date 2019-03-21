"use strict";

function error(source, token, current, str) {
  const consume_position = token.index;
  const maxTokens = 5; // arbitrary but works well enough
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

function groupDefinitions(all) {
  const unique = new Map();
  const duplicates = new Set();
  const partials = new Map();
  for (const def of all) {
    if (def.partial) {
      const array = partials.get(def.name);
      if (array) {
        array.push(def);
      } else {
        partials.set(def.name, [def]);
      }
      continue;
    }
    if (!def.name) {
      continue;
    }
    if (!unique.has(def.name)) {
      unique.set(def.name, def);
    } else {
      duplicates.add(def);
    }
  }
  return { all, unique, partials, duplicates };
}

function* checkDuplicatedNames({ unique, duplicates }) {
  for (const dup of duplicates) {
    const { name } = dup;
    const message = `The name "${name}" of type "${unique.get(name).type}" was already seen`;
    yield error(dup.source, dup.tokens.name, dup, message);
  }
}

function* checkInterfaceMemberDuplication(defs) {
  const interfaces = [...defs.unique.values()].filter(def => def.type === "interface");
  const includesMap = getIncludesMap();

  for (const i of interfaces) {
    yield* forEachInterface(i);
  }

  function* forEachInterface(i) {
    const opNames = new Set(getOperations(i).map(op => op.name));
    const partials = defs.partials.get(i.name) || [];
    const mixins = includesMap.get(i.name) || [];
    for (const ext of [...partials, ...mixins]) {
      const additions = getOperations(ext);
      yield* forEachExtension(additions, opNames, ext, i);
      for (const addition of additions) {
        opNames.add(addition.name);
      }
    }
  }

  function* forEachExtension(additions, existings, ext, base) {
    for (const addition of additions) {
      const { name } = addition;
      if (name && existings.has(name)) {
        const message = `The operation "${name}" has already been defined for the base interface "${base.name}" either in itself or in a mixin`;
        yield error(ext.source, addition.body.tokens.name, ext, message);
      }
    }
  }

  function getOperations(i) {
    return i.members
      .filter(({type}) => type === "operation");
  }

  function getIncludesMap() {
    const map = new Map();
    const includes = defs.all.filter(def => def.type === "includes");
    for (const include of includes) {
      const array = map.get(include.target);
      const mixin = defs.unique.get(include.includes);
      if (!mixin) {
        continue;
      }
      if (array) {
        array.push(mixin);
      } else {
        map.set(include.target, [mixin]);
      }
    }
    return map;
  }
}

export function validate(ast) {
  const defs = groupDefinitions(ast);
  return [
    ...checkDuplicatedNames(defs),
    ...checkInterfaceMemberDuplication(defs)
  ];
}
