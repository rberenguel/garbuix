export { convert, hasArrow, getAttrsArrow };

import { DEBUG } from "./flags.js";
import {
  headerT,
  solarizedColors,
  darkColors,
  lightColors,
  lateBinding,
} from "./templates.js";
import { operators } from "./present_eval.js";

// Although this is a big dense, it is just a pretty direct term replacer,
// rewriting "my syntax" into valid Graphviz, while applying some additional
// steps.

const hasArrow = (text) => {
  const flag = text.includes("->");
  return flag;
};

const hasSubgraph = (text) => text.includes("subgraph cluster_"); // Only supporting clusters, no other
const hasCluster = (text) => text.trim().startsWith("cluster ");
const hasReplacement = (text) => /^\s*\$\S+\s*=\s*.*$/.test(text);
const getReplacement = (text) => {
  // If a replacement is available it is easier to _not_ use regexes
  const split = text.split("=");
  const key = split[0].trim();
  const replacement = split.slice(1).join("=").trim();
  return [key, replacement];
};
const hasURL = (text) => text.includes("URL=") || text.includes("URL = "); // To also cover the post-formatted case
const isComment = (text) => /^\s*\/\/.*/.test(text);
const onlyBraces = (text) => /^\s*{\s*$/.test(text) || /^\s*}\s*$/.test(text);
const onlyAttrs = (text) => /^\s*\w+=.*\s*$/.test(text);
const getAttrsArrow = (text) => /^\s*\S+\s*->\s*\S+\s+(.*)$/.exec(text);
const getAttrsNode = (text) => /^\s*\S+\s+(.*)$/.exec(text);
const getSubgraphCluster = (text) =>
  /^\s*subgraph cluster_(\w+).*{.*$/.exec(text);
const getLoneCluster = (text) => /^\s*cluster\s+(\S+).*{.*$/.exec(text);
const isRGBAHex = (text) => /^#[0-9a-f]{8}$/.test(text.trim());

const labelBreaker = (text) => {
  const leftAlign = "\\l";
  if (text.length > 30 && !text.includes("\\n")) {
    const words = text.split(" ");
    let lines = [];
    let line = "";
    for (let word of words) {
      line += `${word} `;
      if (line.length > 30) {
        lines.push(line);
        line = "";
      }
    }
    lines.push(line);
    lines.push("");
    return lines.join(leftAlign);
  } else {
    return text;
  }
};

const convert = (text) => {
  const tab = "  ";
  const ttab = tab + tab;
  let result = [];
  let replacements = [];
  let header = headerT;
  let lines = text.split("\n");
  result.push(
    tab +
      `label="\\n${lines[0].replace("# ", "").replace("[calc]", "")}\\n\\n";`,
  );
  const sliced = solarizedColors.split("\n").concat(lines.slice(1));
  if (lines.map((l) => l.trim()).includes("$DARK")) {
    lines = darkColors.split("\n").concat(sliced);
  } else {
    lines = lightColors.split("\n").concat(sliced);
  }
  lines = lines.concat(lateBinding.split("\n"));
  console.log(lines);
  let clusters = [];
  for (let line of lines) {
    if (line.trim() === "$DARK") {
      continue;
    }
    for (let replacement of replacements) {
      let [key, value] = replacement;
      line = line.replaceAll(key, value);
    }
    if (
      onlyBraces(line) ||
      onlyAttrs(line) ||
      isComment(line) ||
      line.startsWith("/*")
    ) {
      result.push(tab + line + " // only");
      continue;
    }
    if (hasReplacement(line)) {
      if (DEBUG.convert) console.log(`Replacement found on line '${line}'`);
      const key = getReplacement(line)[0];
      const value = getReplacement(line)[1];
      if (DEBUG.convert) console.log(`Replacement found ${key} ${value}`);
      replacements.push([key, value]);
      continue;
    }
    if (hasSubgraph(line) || hasCluster(line)) {
      let cluster;
      if (hasSubgraph(line)) {
        cluster = getSubgraphCluster(line)[1];
      } else {
        cluster = getLoneCluster(line)[1];
      }
      clusters.push(cluster);
      // Add standard formatting
      let fill;
      for (let word of line.split(" ")) {
        if (isRGBAHex(word)) {
          fill = ttab + `fillcolor="${word.trim()}"`;
          line = line.replaceAll(word.trim(), "");
        }
      }
      result.push(tab + `subgraph cluster_${cluster} {`);
      result.push(ttab + `style="filled, rounded, dotted"`);
      if (fill !== undefined) {
        result.push(fill);
      }
      // Add invisible cluster name node and label
      result.push(ttab + `label="${cluster}"`);
      result.push(
        ttab + `${cluster} [style=invis,width=0,label="",fixedsize=true]`,
      );
      continue;
    }
    let attrs, src, dst;
    for (const op in operators) {
      const name = operators[op].name;
      line = line.replaceAll(op, name);
    }
    if (hasArrow(line)) {
      attrs = getAttrsArrow(line);
      const match = /^\s*(\S+)\s*->\s*(\S+).*$/.exec(line);
      src = match[1];
      dst = match[2];
      src = src.trim();
      dst = dst.trim();
    } else {
      attrs = getAttrsNode(line);
    }
    let addendum = "";
    if (src && clusters.includes(src)) {
      addendum = ` ltail="cluster_${src}"`;
    }
    if (dst && clusters.includes(dst)) {
      addendum = ` lhead="cluster_${dst}"`;
    }
    if (!attrs || attrs.length == 1) {
      const compoundEdge = addendum != "" ? ` [${addendum}]` : "";
      result.push(tab + line + compoundEdge);
      continue;
    }
    const linkUTF = hasURL(attrs[1]) ? " 🔗" : "";
    let [label, props] = attrs[1].split(";");
    if (hasArrow(line) && label.trim() == "!") {
      console.log("It is invisible");
      label = "";
      props = (props ? props : "") + "style=invis";
    }
    label = label.trim();
    label = label.replace(/^\[\]/, "🟨").replace(/^\[ \]/, "🟨");
    label = label.replace(/^\[X\]/, "✅").replace(/^\[x\]/, "✅");
    const labelPropper = (label, props) =>
      `[label="${labelBreaker(label)}${linkUTF}"${
        props ? " " + props : ""
      }${addendum}]`;
    const labelHTMLPropper = (label, props) =>
      `[label=${label}${linkUTF}>${props ? " " + props : ""}${addendum}]`
        .replace("\\n", "<br/>")
        .replace("\\l", "<br/>");
    const operation = line.replace(" " + attrs[1], " ");
    let converted;
    if (label.startsWith("<")) {
      converted = `${operation} ${labelHTMLPropper(label, props)}`;
    } else {
      converted = `${operation} ${labelPropper(label, props)}`;
    }
    if (!hasArrow(line) && label.trim() == "=") {
      converted = `${operation} ${labelPropper(operation.trim(), props)}`;
    }
    result.push(tab + converted);
  }
  for (let replacement of replacements) {
    const [key, value] = replacement;
    if (DEBUG.convert) console.info(`(header) Replacing ${key} by ${value}`);
    header = header.replaceAll(key, value);
  }
  let joined = header + "\n" + result.join("\n");
  return joined;
};
