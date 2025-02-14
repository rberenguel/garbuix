export { evaluate };

// TODO: This can be moved to a separate file and tested in isolation
import { DEBUG } from "./flags.js";
import {
  isOp,
  isNumber,
  isPercent,
  operators,
  formatVal,
} from "./present_eval.js";
import { hasArrow, getAttrsArrow } from "./convert.js";
const edgeKey = (src, dst) => `e-${src}-${dst}`;

const splitArrow = (text) => /^\s*(\S+\s*->\s*\S+)\s*(.*)$/.exec(text);

const getArrowSrcDst = (line) => {
  const match = /^\s*(\S+)\s*->\s*(\S+).*$/.exec(line);
  let src = match[1]; // TODO this is failing
  let dst = match[2];
  src = src.trim();
  dst = dst.trim();
  return [src, dst];
};

const evaluate = (cmapText, max_steps = 5) => {
  let lines = cmapText.split("\n");
  // Rewrite
  let edgeValues = {};
  let nodeValues = {};
  let bySrc = {};
  let byDst = {};
  for (const line of lines) {
    // Get values out of edges. This likely only is done once
    if (hasArrow(line)) {
      let [src, dst] = getArrowSrcDst(line);
      const key = edgeKey(src, dst);
      if (isOp(src) || isOp(dst)) {
        if (key in edgeValues) {
          // If this edge already has a value, we don't need to touch it anymore,
          // any updates are done at the evaluation level
          continue;
        }
        const attrs = getAttrsArrow(line);
        let argument;
        if (!attrs || attrs.length <= 1) {
          // Could be a forward (non computed) argument, non-typed yet, who knows. We need to populate it though, as empty
          edgeValues[key] = [];
          argument = undefined;
        } else {
          argument = attrs[1].split(" ")[0];
        }
        // Make the graph easier to access by properties
        if (!(src in bySrc)) {
          bySrc[src] = [dst];
        } else {
          bySrc[src].push(dst);
        }
        if (!(dst in byDst)) {
          byDst[dst] = [src];
        } else {
          byDst[dst].push(src);
        }
        // The _extracted_ argument is always the first one

        if (isNumber(argument)) {
          if (isPercent(argument)) {
            edgeValues[key] = [
              {
                value: parseFloat(argument) / 100.0,
                kind: "pct",
              },
            ];
          } else {
            edgeValues[key] = [
              {
                value: parseFloat(argument),
                kind: "num",
              },
            ];
          }
        }
      }
    }
  }
  // Evaluation
  // It starts for nodes by destination:
  // - Carry-over nodes (those that affect their outgoing edges)
  // - Non-carry-over nodes (those that just take arguments and emit a result)
  for (let step = 0; step < max_steps; step++) {
    for (const dst in byDst) {
      const op = isOp(dst);
      if (op) {
        // Then we need to evaluate all incoming edges and modify the corresponding out edge
        // We use the last value in the edge values, edge values is holding a history for that edge
        const srcs = byDst[dst];
        const values = srcs
          .map((src) => edgeValues[edgeKey(src, dst)].slice(-1)[0])
          .filter((v) => v !== undefined);
        const dsts = bySrc[dst] || [];
        if (!operators[op].name.includes("carry")) {
          let evaluation = {
            value: operators[op].op(...values.map((v) => v.value)),
          };
          if (values.every((e) => e.kind == "pct")) {
            evaluation.kind = "pct";
          } else {
            evaluation.kind = "num";
          }
          // Now modify the outgoing edges of this operator with this value
          for (const _dst of dsts) {
            const key = edgeKey(dst, _dst); // so, we are going from what already was a destination operator
            if (edgeValues[key]) {
              if (edgeValues[key].length >= 2) {
                // Do not evaluate an edge more than once
                continue;
              }
              edgeValues[key].push(evaluation);
            } else {
              edgeValues[key] = [evaluation];
            }
          }
          nodeValues[dst] = evaluation;
        } else {
          // If it contains carry, the evaluation is against the _outer edge value_
          for (const _dst of dsts) {
            const key = edgeKey(dst, _dst); // so, we are going from what already was a destination operator
            let _values = values;
            if (edgeValues[key]) {
              if (edgeValues[key].length >= 2) {
                // Do not evaluate an edge more than once
                continue;
              }
              // We have a destination value to add and change
              _values = values.concat(edgeValues[key]);
            }
            let evaluation = {
              value: operators[op].op(..._values.map((v) => v.value)),
            };
            if (_values.every((e) => e.kind == "pct")) {
              evaluation.kind = "pct";
            } else {
              evaluation.kind = "num";
            }
            if (edgeValues[key]) {
              if (edgeValues[key].length >= 2) {
                // Do not evaluate an edge more than once
                continue;
              }
              edgeValues[key].push(evaluation);
            } else {
              edgeValues[key] = [evaluation];
            }
          }
        }
      }
    }
  }
  // Once all the evaluations have stabilised or we ran out of iterations, update the edge texts with the changes
  let updatedLines = [];
  if (DEBUG.evaluate) {
    console.log("nodeValues");
    console.log(nodeValues);
    console.log("edgeValues");
    console.log(edgeValues);
  }
  for (let line of lines) {
    if (hasArrow(line)) {
      let [src, dst] = getArrowSrcDst(line);
      const key = edgeKey(src, dst);
      const values = edgeValues[key];
      if (values) {
        // This needs to update only the first part of the attributes section, i.e. the label
        const split = splitArrow(line);
        const arrow = split[1].trim();
        let attrs = split[2].trim().split(" ");
        let text;
        if (values.length > 1) {
          text = `<<font color="sdgreen">${formatVal(
            values.slice(-1)[0],
          )}</font>   (${formatVal(values[0])})`;
        } else {
          text = `<${formatVal(values[0])}`;
        }
        attrs[0] = text;
        const _attrs = attrs.join(" ");
        line = `${arrow} ${_attrs}`; // The closing > is added by the cmap converter when it is in the opening
      }
    } else {
      const node = line.trim().split(" ")[0];
      if (node in nodeValues) {
        let splits = line.split(";");
        splits[0] = splits[0] + ` (${formatVal(nodeValues[node])})`;
        line = splits.join(";");
      }
    }
    updatedLines.push(line);
  }
  return updatedLines.join("\n");
};
