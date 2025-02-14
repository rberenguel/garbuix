export { getAllReplacementKeys, getReplacements, replaceAll };

import { DEBUG } from "./flags.js";
import { graphvizKeywords } from "./keywords.js";

const hasReplacement = (text) => /^\s*\$\S+\s*=\s*.*$/.test(text);
const hasMdReplacement = (text) => /^-\s+\S+\s*:\s*.*$/.test(text);
// Note that these two regexes are intersecting
const hasLambdaReplacement = (text) => /^\s*\$\S+\(\S+\)\s*=\s*.*$/.test(text);
const hasLambdaMdReplacement = (text) => /^-\s+\S+\(\S+\)\s*:\s/.test(text);
const getReplacement = (text) => {
  // If a replacement is available it is easier to _not_ use regexes
  const split = text.split("=");
  const key = split[0].trim();
  const replacement = split.slice(1).join("=").trim();
  return [key, replacement];
};
const getMdReplacement = (text) => {
  // If a replacement is available it is easier to _not_ use regexes
  const split = text.split(":");
  const key = split[0].trim().split("-").slice(1).join("-").trim();
  const replacement = split.slice(1).join(":").trim();
  if (graphvizKeywords.includes(key)) {
    // TODO: I'm not capturing convert errors, and I should do it (when they are "own", at least)
    throw new Error(
      `You can't use a graphviz reserved word as a replacement (was ${key})`,
    );
  }
  return [key, replacement];
};
const getLambdaReplacement = (text) => {
  // If a replacement is available it is easier to _not_ use regexes
  // Format of this should be $FOO(BAR)=somethingBAR, a direct replacement
  //$FOO(x)=#xx99xx99
  const split = text.split("=");
  const key = split[0].trim();
  const fun = key.split("(")[0].trim();
  const arg = key.split("(")[1].split(")")[0].trim();
  const replacement = split.slice(1).join("=").trim();
  const lambda = (foo) => {
    if (DEBUG.convert) {
      console.log(
        `Lambda replacement of '${arg}' by '${foo}' in '${replacement}'`,
      );
    }
    return replacement.replaceAll(arg, foo);
  };
  return [fun, lambda];
};
const getLambdaMdReplacement = (text) => {
  // If a replacement is available it is easier to _not_ use regexes
  // Format of this should be - FOO(BAR): somethingBAR, a direct replacement

  const split = text.split(":");
  const key = split[0].trim().split("-").slice(1).join("-").trim();
  const fun = key.split("(")[0].trim();
  const arg = key.split("(")[1].split(")")[0].trim();
  const replacement = split.slice(1).join(":").trim();
  if (DEBUG.convert) {
    console.log(`${fun}(${arg}) -> ${replacement}`);
  }
  const lambda = (foo) => {
    if (DEBUG.convert) {
      console.log(
        `Lambda replacement of '${arg}' by '${foo}' in '${replacement}'`,
      );
    }
    return replacement.replaceAll(arg, foo);
  };
  if (graphvizKeywords.includes(fun)) {
    throw new Error(
      `You can't use a graphviz reserved word as a replacement (was ${fun})`,
    );
  }
  return [fun, lambda];
};

const getReplacements = (line, replacements, lambdaReplacements) => {
  // Replacement keys listed in skip should be avoided
  if (hasLambdaMdReplacement(line)) {
    if (DEBUG.convert)
      console.log(`Md Lambda replacement found on line '${line}'`);
    const lr = getLambdaMdReplacement(line);
    const key = `${lr[0]}`;
    const value = lr[1];
    if (DEBUG.convert) console.log(`Md Replacement found ${key} ${value}`);
    lambdaReplacements.push([lr[0], lr[1]]);
    return true;
  }
  if (hasLambdaReplacement(line)) {
    if (DEBUG.convert)
      console.log(`Lambda replacement found on line '${line}'`);
    const lr = getLambdaReplacement(line);
    const key = lr[0];
    const value = lr[1];
    if (DEBUG.convert) console.log(`Replacement found ${key} ${value}`);
    lambdaReplacements.push([lr[0], lr[1]]);
    return true;
  }
  if (hasReplacement(line)) {
    if (DEBUG.convert) console.log(`Replacement found on line '${line}'`);
    const r = getReplacement(line);
    const key = r[0];
    const value = r[1];
    if (DEBUG.convert) console.log(`Replacement found ${key} ${value}`);
    replacements.push([key, value]);
    return true;
  }
  if (hasMdReplacement(line)) {
    if (DEBUG.convert) console.log(`Md Replacement found on line '${line}'`);
    const r = getMdReplacement(line);
    const key = r[0];
    const value = r[1];
    if (DEBUG.convert) console.log(`Md Replacement found ${key} ${value}`);
    replacements.push([key, value]);
    return true;
  }
  return false;
};

const getAllReplacementKeys = (lines) => {
  let keys = [];
  for (let line of lines) {
    if (/^-\s+\S+:\s+.*$/.test(line)) {
      const key = line.split(":")[0].slice(1).trim();
      keys.push(key);
    }
  }
  return keys;
};

const replaceAll = (line, replacements, lambdaReplacements) => {
  // Lambda replacements should have priority, sinche there is a natural
  // assumption we might define YELLOW() and YELLOW
  for (let lr of lambdaReplacements) {
    if (DEBUG.convert) {
      //console.log(`Matching ${lr[0]}-${lr[1]} on ${line}`)
    }
    let [funname, lambda] = lr;
    const funheader = funname[0] === "$" ? "\\$" : funname[0];
    let stringy = `${funheader}${funname.slice(1)}\\(([^\\)]+)\\)`;
    let regex = new RegExp(stringy);
    line = line.replace(regex, (match, arg) => {
      // match:  The full match (e.g., "fun(foo)")
      // arg:    The captured group (the argument, e.g., "foo")
      return lambda(arg.trim());
    });
  }
  for (let replacement of replacements) {
    let [key, value] = replacement;
    line = line.replaceAll(key, value);
  }
  return line;
};
