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

// Although this is a bit dense, it is just a pretty direct term replacer,
// rewriting "my syntax" into valid Graphviz, while applying some additional
// steps.

const hasArrow = (text) => {
  const flag = text.includes("->");
  return flag;
};

const hasSubgraph = (text) => text.includes("subgraph cluster_"); // Only supporting clusters, no other
const hasCluster = (text) => text.trim().startsWith("cluster ");
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
  const key = split[0].trim().split("-")[1].trim();
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
  const key = split[0].trim().split("-")[1].trim();
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
  let allNodes = {};
  let inCommentBlock = false;
  const tab = "  ";
  const ttab = tab + tab;
  let result = [];
  let replacements = [];
  let lambdaReplacements = [];
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
  let clusters = [];
  for (let line of lines) {
    if (line.trim() === "$DARK") {
      continue;
    }
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
      console.log(regex);
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
    if (hasLambdaMdReplacement(line)) {
      if (DEBUG.convert)
        console.log(`Md Lambda replacement found on line '${line}'`);
      const lr = getLambdaMdReplacement(line);
      const key = `${lr[0]}`;
      const value = lr[1];
      if (DEBUG.convert) console.log(`Md Replacement found ${key} ${value}`);
      lambdaReplacements.push([lr[0], lr[1]]);
      continue;
    }
    if (hasLambdaReplacement(line)) {
      if (DEBUG.convert)
        console.log(`Lambda replacement found on line '${line}'`);
      const lr = getLambdaReplacement(line);
      const key = lr[0];
      const value = lr[1];
      if (DEBUG.convert) console.log(`Replacement found ${key} ${value}`);
      lambdaReplacements.push([lr[0], lr[1]]);
      continue;
    }
    if (hasReplacement(line)) {
      if (DEBUG.convert) console.log(`Replacement found on line '${line}'`);
      const r = getReplacement(line);
      const key = r[0];
      const value = r[1];
      if (DEBUG.convert) console.log(`Replacement found ${key} ${value}`);
      replacements.push([key, value]);
      continue;
    }
    if (hasMdReplacement(line)) {
      if (DEBUG.convert) console.log(`Md Replacement found on line '${line}'`);
      const r = getMdReplacement(line);
      const key = r[0];
      const value = r[1];
      if (DEBUG.convert) console.log(`Md Replacement found ${key} ${value}`);
      replacements.push([key, value]);
      continue;
    }
    // Replacements can be in comments, so they need to be processed before discarding
    if (inCommentBlock) {
      result.push(line.trim());
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
  let replacementsMap = {};
  for (let replacement of replacements) {
    const [key, value] = replacement;
    if (DEBUG.convert) console.info(`(header) Replacing ${key} by ${value}`);
    header = header.replaceAll(key, value);
    replacementsMap[key] = value;
  }
  let joined = header + "\n" + result.join("\n");
  return {
    conversion: joined,
    nodes: Object.keys(allNodes),
    replacements: replacementsMap,
  };
};

const graphvizKeywords = [
  "_background",
  "area",
  "arrowhead",
  "arrowsize",
  "arrowtail",
  "bb",
  "beautify",
  "bgcolor",
  "center",
  "charset",
  "class",
  "cluster",
  "clusterrank",
  "color",
  "colorscheme",
  "comment",
  "compound",
  "concentrate",
  "constraint",
  "Damping",
  "decorate",
  "defaultdist",
  "dim",
  "dimen",
  "dir",
  "diredgeconstraints",
  "distortion",
  "dpi",
  "edgehref",
  "edgetarget",
  "edgetooltip",
  "edgeURL",
  "epsilon",
  "esep",
  "fillcolor",
  "fixedsize",
  "fontcolor",
  "fontname",
  "fontnames",
  "fontpath",
  "fontsize",
  "forcelabels",
  "gradientangle",
  "group",
  "head_lp",
  "headclip",
  "headhref",
  "headlabel",
  "headport",
  "headtarget",
  "headtooltip",
  "headURL",
  "height",
  "href",
  "id",
  "image",
  "imagepath",
  "imagepos",
  "imagescale",
  "inputscale",
  "K",
  "label",
  "label_scheme",
  "labelangle",
  "labeldistance",
  "labelfloat",
  "labelfontcolor",
  "labelfontname",
  "labelfontsize",
  "labelhref",
  "labeljust",
  "labelloc",
  "labeltarget",
  "labeltooltip",
  "labelURL",
  "landscape",
  "layer",
  "layerlistsep",
  "layers",
  "layerselect",
  "layersep",
  "layout",
  "len",
  "levels",
  "levelsgap",
  "lhead",
  "lheight",
  "linelength",
  "lp",
  "ltail",
  "lwidth",
  "margin",
  "maxiter",
  "mclimit",
  "mindist",
  "minlen",
  "mode",
  "model",
  "newrank",
  "nodesep",
  "nojustify",
  "normalize",
  "notranslate",
  "nslimit",
  "nslimit1",
  "oneblock",
  "ordering",
  "orientation",
  "outputorder",
  "overlap",
  "overlap_scaling",
  "overlap_shrink",
  "pack",
  "packmode",
  "pad",
  "page",
  "pagedir",
  "pencolor",
  "penwidth",
  "peripheries",
  "pin",
  "pos",
  "quadtree",
  "quantum",
  "rank",
  "rankdir",
  "ranksep",
  "ratio",
  "rects",
  "regular",
  "remincross",
  "repulsiveforce",
  "resolution",
  "root",
  "rotate",
  "rotation",
  "samehead",
  "sametail",
  "samplepoints",
  "scale",
  "searchsize",
  "sep",
  "shape",
  "shapefile",
  "showboxes",
  "sides",
  "size",
  "skew",
  "smoothing",
  "sortv",
  "splines",
  "start",
  "style",
  "stylesheet",
  "tail_lp",
  "tailclip",
  "tailhref",
  "taillabel",
  "tailport",
  "tailtarget",
  "tailtooltip",
  "tailURL",
  "target",
  "TBbalance",
  "tooltip",
  "truecolor",
  "URL",
  "vertices",
  "viewport",
  "voro_margin",
  "weight",
  "width",
  "xdotversion",
  "xlabel",
  "xlp",
  "z",
];
