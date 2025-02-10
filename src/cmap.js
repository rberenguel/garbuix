// From my github.com/rberenguel/cmap-helper

export { cmapRender };

import { evaluate } from "./cmap/evaluator.js";
import { convert } from "./cmap/convert.js";

const cmapRender = (d) => {
  const cmap = d.innerText
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
  const normalize = (str) => str.normalize("NFKD");
  // Analysis and regeneration of operators is best _before_ conversion, because then I can use all the properties
  let gv;
  if (cmap.split("\n")[0].endsWith(" [calc]")) {
    const evaluated = evaluate(cmap);
    gv = convert(normalize(evaluated));
    gv.conversion += "\n}";
  } else {
    gv = convert(normalize(cmap));
    gv.conversion += "\n}";
  }
  return gv;
};

// Spec

// Node definition
// Node Blah blah node; styledefs

// Arrow? Then it's an edge
// Node1 -> Node2 Blah blah edge; styledefs

// To allow positioning commands and subgraph settings
// foo=bar // With no spaces, has no conversion
// { } are ignored if they are the only character aside from spaces
// Handles compound and subgraphs, automatically creates an invisible
// node in the cluster.

// This runs one single pass, so clusters need to be defined before the
// compound nodes are used
