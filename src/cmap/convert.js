export { convert, hasArrow, getAttrsArrow, getAllReplacementKeys };

import {
  getReplacements,
  getAllReplacementKeys,
  replaceAll,
} from "./replacements.js";

import {
  headerT,
  solarizedColors,
  darkColors,
  lightColors,
  lateBinding,
} from "./templates.js";
import { operators } from "./present_eval.js";

// Although this is a bit dense, it is just a pretty direct term replacer,
// rewriting "my syntax" into valid Graphviz, while applying some additional
// steps.

const hasArrow = (text) => {
  const flag = text.includes("->");
  return flag;
};

const hasSubgraph = (text) => text.includes("subgraph cluster_"); // Only supporting clusters, no other
const hasCluster = (text) => text.trim().startsWith("cluster ");

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

const filteredLateBindings = (defined) => {
  const lateBindings = lateBinding.split("\n");
  return lateBindings.filter((lb) => {
    return !defined.includes(lb.split(":")[0].slice(1).trim());
  });
};

const convert = (text) => {
  let allNodes = {};
  let inCommentBlock = false;
  const tab = "  ";
  const ttab = tab + tab;
  let result = [];
  let replacements = [];
  let lambdaReplacements = [];
  let lines = text.split("\n");
  const title =
    tab +
    `label="\\n${lines[0].replace("# ", "").replace("[calc]", "")}\\n\\n";`;
  const sliced = solarizedColors.split("\n").concat(lines.slice(1));
  if (lines.map((l) => l.trim()).includes("- dark")) {
    lines = darkColors.split("\n").concat(sliced);
  } else {
    lines = lightColors.split("\n").concat(sliced);
  }

  const allKeys = getAllReplacementKeys(lines);
  const filteredLate = filteredLateBindings(allKeys);
  lines = lines.concat(filteredLate);
  let clusters = [];
  for (let line of lines) {
    if (line.trim() === "- dark") {
      continue;
    }

    line = replaceAll(line, replacements, lambdaReplacements);
    if (line.startsWith("/*")) {
      inCommentBlock = true;
    }
    if (line.startsWith("*/")) {
      inCommentBlock = false;
    }
    // Sadly I rely on having comments smartly to apply replacements, so it's not easy to force them to exist othewise
    if (
      onlyBraces(line) ||
      onlyAttrs(line) ||
      isComment(line) ||
      line.trim().startsWith("/*")
    ) {
      result.push(tab + line);
      continue;
    }
    if (line.trim().startsWith("#")) {
      // Skip any Markdown-like titles, so this should be almost renderable as markdown)
      result.push("// " + line);
      continue;
    }
    if (getReplacements(line, replacements, lambdaReplacements)) continue;

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
    try {
      if (hasArrow(line)) {
        attrs = getAttrsArrow(line);
        const match = /^\s*(\S+)\s*->\s*(\S+).*$/.exec(line);
        src = match[1];
        dst = match[2];
        src = src.trim();
        dst = dst.trim();
        allNodes[src] = true;
        allNodes[dst] = true;
      } else {
        attrs = getAttrsNode(line);
      }
    } catch (err) {
      // This is harmless, happens while typing
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
    label = label.trim();
    let node = attrs[0].split(" ")[0].trim();

    if (label === "" && !hasArrow(line)) {
      // This fixes the nodes with Name ; props i.e. with no explicit label.
      label = node;
    }
    if (!hasArrow(line) && !inCommentBlock) {
      allNodes[node] = true;
    }
    if (hasArrow(line) && label.trim() == "!") {
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
  let headerLines = [];
  for (let line of headerT(title).split("\n")) {
    headerLines.push(replaceAll(line, replacements, lambdaReplacements));
  }

  let replacementsMap = {};
  for (let replacement of replacements) {
    const [key, value] = replacement;
    replacementsMap[key] = value;
  }
  let joined = headerLines.join("\n") + "\n" + result.join("\n");
  return {
    conversion: joined,
    nodes: Object.keys(allNodes),
    replacements: replacementsMap,
  };
};
