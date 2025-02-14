export { graphvizRender };

import { Graphviz } from "../lib/graphviz.js";

import { reverseOperatorMapping } from "./cmap/present_eval.js";

const dotExample = `
digraph G {
  layout="dot"
  margin="0.5"
  bgcolor="#ffffffff"
  rankdir="TB"
  fontname="monoidregular"
  overlap="scale"
  node [
    fontname = "monoidregular"
    style="rounded,filled"
    labelloc="c"
    margin="0.3,0.15"
    splines="true"
    shape="rect"
    fontsize="14"
  ];
  edge [
    minlen="2"
    penwidth="1"
    color="#33333333"
    fontname="monoidregular"
    fontsize="7"
    arrowhead="none"
  ];
  
  fontsize="24"
  labelloc="t";
  label="\nKafka\n\n";
  
  Topics
  Topics -> Internal [label="can be"]
  Topics -> User [label="can be"]
  cg [label=" Consumer groups "]
  cg -> Consumers [label="have"]
  User -> cg [label="consumed by"]
  Topics -> Partitions [label="have"]
  {
    rank=same
    Partitions [label=" Partitions "]
    Offset
  }
  Partitions -> Records [label="contain"]
  Partitions -> Consumers [label="read from"]
  Consumers -> Topics [label="can read from several" arrowhead=normal]
  Records -> Ordered [label="are partially"]
  kv [label="Key-value"]
  Records -> kv [label="are"]
  kv -> Tombstone [label="value=null"]
  sk [label="Same key"]
  kv -> sk [label="can have"]
  sk -> sp [label="go to"]
  Compaction -> sk [label="keeps latest with"]
  Time -> Compaction [label="required by"]
  ret [label="Record expiration time" shape="none" style=none fontsize=9]
  Time -> Expiration [label="required by"]
  Expiration -> ret [style=dashed]
  Records -> Time [label="have"]
  Records -> sk [label="can have"]
  Ordered -> Time [label="by"]
  Consumers -> Offset [label="start at"]
  Consumers -> Offset [label="\n\nkeep track of"]
  Offset -> Internal [label="is stored in"]
  Offset -> Ordered [label="requires"]
  sp [label="   Same partition   "]
  sp -> Ordered [label=" is completely" arrowhead=normal]
}
    `;

const graphvizRender = async (info, c, d, e) => {
  try {
    if (!document.graphviz) {
      document.graphviz = await Graphviz.load();
    }
    const gv = info.conversion;
    const replacements = info.replacements;
    const rendered = document.graphviz.layout(gv, "svg", "dot");
    if (rendered.includes("<svg")) {
      let pan, zoom;
      if (d.panzoom) {
        pan = d.panzoom.getPan();
        zoom = d.panzoom.getZoom();
      }
      d.innerHTML = rendered;
      d.panzoom = svgPanZoom(d.querySelector("svg"), {
        controlIconsEnabled: true,
        dblClickZoomEnabled: false,
        minZoom: 0.01,
        maxZoom: 20,
      });
      d.querySelector("#svg-pan-zoom-controls").style.transform =
        "translate(0, 0)";
      if (pan) {
        // Beware of order!
        try {
          d.panzoom.zoom(zoom);
          d.panzoom.pan(pan);
        } catch (err) {
          console.log("Panzoom error");
          console.error(err);
        }
        if (gv.includes("// zoom:")) {
          console.info("Has zoom directive");
          try {
            for (let line of gv.split("\n")) {
              // // zoom: 1234 pan: 5 5
              if (line.includes("// zoom:")) {
                let fixed = line
                  .trim()
                  .replace("// ", "")
                  .replace("zoom:", "")
                  .trim();
                let [zoom_, ...rest] = fixed.split(" ");
                // rest = "pan", "5", "5"
                const zoom = parseFloat(zoom_.trim());
                const x = parseFloat(rest[1]);
                const y = parseFloat(rest[2]);

                if (Number.isNaN(x * y)) {
                  throw new Error("Pan is not a number");
                }
                const pan = { x: x, y: y };
                d.panzoom.zoom(zoom);
                d.panzoom.pan(pan);
              }
            }
          } catch (err) {
            console.error("Error using the pan-zoom directive");
            console.error(err);
          }
        }
      }
      d.classList.remove("error");

      /* Big block of mess starts*/
      d.mark = new Mark(c);
      c.mark = d.mark;
      d.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
      });
      const links = Array.from(d.querySelectorAll("a")); //
      links.forEach((a) => a.setAttribute("target", "_blank"));
      links.forEach((a) => {
        a.addEventListener("click", (ev) => {
          // hrefs are visited on click, not mouseup or down
          const node = a.closest(".node");
          if (node && node.held) {
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            node.held = false;
          } else {
            const href = a.href.baseVal;
            if (!href.startsWith("http")) {
              // this is something weird from SVG
              ev.preventDefault();
              ev.stopPropagation();
              ev.stopImmediatePropagation();
              // TODO this comes from formatters.js as is
              const n = weave.bodies().length;
              const bodyId = `b${n}`; // TODO NO, this is not good enough
              createPanel(weave.root, bodyId, weave.buttons(weave.root), weave);
              const body = document.getElementById(bodyId);
              iloadIntoBody(href, body);
              toTop(body)(); // This is not working well
            }
          }
        });
      });
      const hasPercentage = (text) => /^.* \([0-9]+%\)$/.test(text);
      const hasPercentageEdge = (text) => /^[0-9]+%.*$/.test(text);
      const getPercentageString = (text) => text.split(" ").slice(-1)[0];
      const getPercentage = (text) => text.replace("(", "").replace(")", "");
      const getPercentageEdgeString = (text) => text.split(" ")[0];
      const nodes = Array.from(d.querySelectorAll(".node"));
      const edges = Array.from(d.querySelectorAll(".edge"));
      edges.forEach((e) => {
        // THIS IS NOW PRETTY MUCH DUPLICATED 100%
        let title = "";
        if (e.querySelector("text")) {
          title = e.querySelector("text").textContent;
        }
        // This should be conditional on being a op graph
        if (hasPercentageEdge(title)) {
          const polygon = e.querySelector("polygon"); // In the arrowhead
          if (!polygon) {
            console.debug("There are no polygons in here");
            return;
          }
          const pathLength = polygon.getTotalLength();

          // Get the coordinates of the point at 50% of the path length
          const point = polygon.getPointAtLength(pathLength * 0.5);
          const text = e.querySelector("text");
          const pbcr = polygon.getBoundingClientRect();
          const size = parseFloat(text.getAttribute("font-size"));
          const percentageString = getPercentageEdgeString(title);
          const props = {
            cx: point.x,
            cy: point.y,
            radius: size / 2,
          };

          const pct = parseFloat(getPercentage(percentageString)) / 100.0;
          if (percentageString.endsWith("%")) {
            let color = "#dc322fFF"; // Solarized red
            if (pct >= 0.4) {
              color = "#b58900FF"; // Solarized yellow
            }
            if (pct >= 0.8) {
              color = "#859900FF"; // Solarized green
            }
            props.color = color;
            createPercentagePieChart(e, 100 * pct, props);
          }
        }
      });
      nodes.forEach((n) => {
        const title = n.querySelector("text").textContent;
        const nodeTitle = n.querySelector("title").textContent;
        const titleObj = n.querySelector("title").textContent;
        if (hasPercentage(title)) {
          const path = n.querySelector("path");
          const text = n.querySelector("text");
          const pbcr = path.getBoundingClientRect();
          const x = text.x.baseVal[0].value;
          const y = text.y.baseVal[0].value;
          const size = parseFloat(text.getAttribute("font-size"));
          const percentageString = getPercentageString(title);
          const props = {
            cx: x + pbcr.width - size / 2,
            cy: y + pbcr.height / 2,
            radius: size / 2,
          };
          const pct = parseFloat(getPercentage(percentageString)) / 100.0;
          if (percentageString.endsWith("%")) {
            let color = "#dc322fFF"; // Solarized red
            if (pct >= 0.4) {
              color = "#b58900FF"; // Solarized yellow
            }
            if (pct >= 0.8) {
              color = "#859900FF"; // Solarized green
            }
            props.color = color;
            createPercentagePieChart(n, 100 * pct, props);
          }
        }
        interact(n).on("hold", (ev) => {
          n.held = true;
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          if (ev.button != 0) {
            // Want to avoid right-click-menu counting as hold, very annoying
            return;
          }
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          c.mark.unmark();
          for (let k in reverseOperatorMapping) {
            if (titleObj.startsWith(k)) {
              c.mark.mark(titleObj.replace(k, reverseOperatorMapping[k]), {
                accuracy: "exactly",
              });
              return;
            }
          }
          c.mark.mark(titleObj, { accuracy: "exactly" });
        });
        if (title.includes("🟨") || title.includes("✅")) {
          let cleanedTitle = "";
          const id = n.closest("g").id;
          const xmlns = "http://www.w3.org/2000/svg"; // SVG namespace URI
          const tspan = document.createElementNS(xmlns, "tspan");
          tspan.classList.add("fawesome");
          tspan.style.fill = replacements["checkboxes-color"]; // Apply the color defined in the diagram, for all checkboxes
          if (title.startsWith("🟨")) {
            // Open checkbox case
            tspan.innerHTML = ""; // fontawesome glyph for open checkbox. For some reason unicode was not working
            tspan.checked = false;
            n.querySelector("text").textContent = title.replace("🟨", "");
            cleanedTitle = n.querySelector("text").textContent.trim();
            n.querySelector("text").prepend(tspan);
            n.classList.remove("crossed");
          }
          if (title.startsWith("✅")) {
            // Closed checkbox case
            tspan.innerHTML = ""; // fontawesome glyph for open checkbox. For some reason unicode was not working
            tspan.checked = true;
            n.querySelector("text").textContent = title.replace("✅", "");
            cleanedTitle = n.querySelector("text").textContent.trim();
            n.querySelector("text").prepend(tspan);
            n.classList.add("crossed");
            n.style.fill = replacements["crossed-color"];
          }
          tspan.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();
            const cmapLines = cmap.innerText.split("\n");
            let rewritten = [];
            if (!tspan.checked) {
              tspan.innerHTML = ""; // fontawesome glyph for closed checkbox
              n.classList.add("crossed");
              n.style.fill = replacements["crossed-color"];
              for (let line of cmapLines) {
                const regex = new RegExp(
                  ".*\\[\\s{0,1}\\] " + `${cleanedTitle}.*`,
                );
                if (regex.test(line)) {
                  line = line.replace("[]", "[X]").replace("[ ]", "[X]");
                }
                rewritten.push(line);
              }
            } else {
              tspan.innerHTML = ""; // fontawesome glyph for open checkbox
              n.classList.remove("crossed");
              for (let line of cmapLines) {
                const regex = new RegExp(
                  ".*\\[[x|X]\\] " + `${cleanedTitle}.*`,
                );
                if (regex.test(line)) {
                  line = line.replace("[x]", "[ ]").replace("[X]", "[ ]");
                }
                rewritten.push(line);
              }
            }
            cmap.innerText = rewritten.join("\n");
            tspan.checked = !tspan.checked;
          });
        }
      });

      /* Big block of mess ends */
      e.innerHTML = "";
    }
  } catch (err) {
    const reloadWorthyErrors = [
      "Out of bounds call_indirect",
      "memory access out of bounds",
      "call_indirect to a signature that does not match",
      "table index is out of bounds",
    ];
    const isReloadWorthy = reloadWorthyErrors.some((string) =>
      err.message.includes(string),
    );
    if (err instanceof Error && isReloadWorthy) {
      document.graphviz = await Graphviz.load();
      return;
    }
    d.classList.add("error");
    e.innerHTML = "";
    const hr = () => document.createElement("HR");
    const nDiv = document.createElement("DIV");
    nDiv.id = "error-name";
    nDiv.innerHTML = err.name;
    const mDiv = document.createElement("DIV");
    mDiv.id = "error-message";
    mDiv.innerHTML = err.message;
    const sDiv = document.createElement("DIV");
    sDiv.id = "error-stacktrace";
    sDiv.innerHTML = err.stack;
    const hDiv = document.createElement("DIV");
    hDiv.id = "error-help";
    const gvError =
      "This error is likely in the graphviz conversion, so maybe you are using some unexpected name or syntax";
    const jsError =
      "This is likely a Javascript problem with the system. Plase report (or debug if you know how)";
    hDiv.innerHTML = err.stack.includes("lib/graphviz.js") ? gvError : jsError;
    e.append(nDiv, hr(), mDiv, hr(), sDiv, hr(), hDiv);
  }
};

const graphviz = {
  text: ["graphviz"],
  action: async (ev, body, source) => {
    if (common(ev)) {
      return;
    }
    if (!body) {
      body = document.getElementById(weave.lastBodyClickId());
    }
    body.style.whiteSpace = "pre-wrap";
    if (!weave.graphviz) {
      weave.graphviz = await Graphviz.load();
    }
    const errPanel = createNextPanel(weave.root);
    const gvPanel = createNextPanel(weave.root, { noGestures: true });
    body.closest(".body-container").relatedContainers = [
      errPanel.querySelector(".body").id,
      gvPanel.querySelector(".body").id,
    ];
    gvPanel.addEventListener("click", () => {
      // A hack to prevent pan-zoom to prevent keyboard commands on the panel
      gvPanel.focus();
    });
    manipulation.set(gvPanel, manipulation.fields.kTitle, "graphviz output");
    manipulation.set(errPanel, manipulation.fields.kTitle, "graphviz errors");
    gvPanel.saveable = false;
    errPanel.saveable = false;
    gvPanel.querySelector(".body").contentEditable = "false";
    errPanel.querySelector(".body").contentEditable = "false";
    manipulation.set(body, manipulation.fields.kKind, "literal");
    const gvBody = gvPanel.querySelector(".body");
    const errBody = errPanel.querySelector(".body");
    const container = body.closest(".body-container");
    const render = async () => {
      toTop(gvPanel)();
      const dot = body.innerText
        .split("\n")
        .map((l) => l.trim())
        .join("\n");
      container.graphvizDestination = gvBody.id;
      container.errorDestination = errBody.id;
      try {
        const rendered = weave.graphviz.layout(dot, "svg", "dot");
        if (rendered.includes("<svg")) {
          container.dot = rendered;
          const div = document.createElement("DIV");
          document.getElementById(container.graphvizDestination).innerHTML = "";
          document
            .getElementById(container.graphvizDestination)
            .appendChild(div);
          let pan, zoom;
          if (gvPanel.panzoom) {
            pan = gvPanel.panzoom.getPan();
            zoom = gvPanel.panzoom.getZoom();
          }
          div.innerHTML = container.dot;
          const cmap = document.getElementById(source);
          div.mark = new Mark(cmap);
          cmap.mark = div.mark;
          const links = Array.from(div.querySelectorAll("a")); //
          links.forEach((a) => a.setAttribute("target", "_blank"));
          links.forEach((a) => {
            a.addEventListener("click", (ev) => {
              // hrefs are visited on click, not mouseup or down
              const node = a.closest(".node");
              if (node && node.held) {
                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();
                node.held = false;
              } else {
                const href = a.href.baseVal;
                if (!href.startsWith("http")) {
                  // this is something weird from SVG
                  ev.preventDefault();
                  ev.stopPropagation();
                  ev.stopImmediatePropagation();
                  // TODO this comes from formatters.js as is
                  const n = weave.bodies().length;
                  const bodyId = `b${n}`; // TODO NO, this is not good enough
                  createPanel(
                    weave.root,
                    bodyId,
                    weave.buttons(weave.root),
                    weave,
                  );
                  const body = document.getElementById(bodyId);
                  iloadIntoBody(href, body);
                  toTop(body)(); // This is not working well
                }
              }
            });
          });
          const hasPercentage = (text) => /^.* \([0-9]+%\)$/.test(text);
          const hasPercentageEdge = (text) => /^[0-9]+%.*$/.test(text);
          const getPercentageString = (text) => text.split(" ").slice(-1)[0];
          const getPercentage = (text) =>
            text.replace("(", "").replace(")", "");
          const getPercentageEdgeString = (text) => text.split(" ")[0];
          const nodes = Array.from(div.querySelectorAll(".node"));
          const edges = Array.from(div.querySelectorAll(".edge"));
          edges.forEach((e) => {
            // THIS IS NOW PRETTY MUCH DUPLICATED 100%
            let title = "";
            if (e.querySelector("text")) {
              title = e.querySelector("text").textContent;
            }
            // This should be conditional on being a op graph
            if (hasPercentageEdge(title)) {
              const polygon = e.querySelector("polygon"); // In the arrowhead
              const pathLength = polygon.getTotalLength();

              // Get the coordinates of the point at 50% of the path length
              const point = polygon.getPointAtLength(pathLength * 0.5);
              const text = e.querySelector("text");
              const pbcr = polygon.getBoundingClientRect();
              const size = parseFloat(text.getAttribute("font-size"));
              const percentageString = getPercentageEdgeString(title);
              const props = {
                cx: point.x,
                cy: point.y,
                radius: size / 2,
              };

              const pct = parseFloat(getPercentage(percentageString)) / 100.0;
              if (percentageString.endsWith("%")) {
                let color = "#dc322fFF"; // Solarized red
                if (pct >= 0.4) {
                  color = "#b58900FF"; // Solarized yellow
                }
                if (pct >= 0.8) {
                  color = "#859900FF"; // Solarized green
                }
                props.color = color;
                createPercentagePieChart(e, 100 * pct, props);
              }
            }
          });
          nodes.forEach((n) => {
            const title = n.querySelector("text").textContent;
            const titleObj = n.querySelector("title").textContent;
            if (hasPercentage(title)) {
              const path = n.querySelector("path");
              const text = n.querySelector("text");
              const pbcr = path.getBoundingClientRect();
              const x = text.x.baseVal[0].value;
              const y = text.y.baseVal[0].value;
              const size = parseFloat(text.getAttribute("font-size"));
              const percentageString = getPercentageString(title);
              const props = {
                cx: x + pbcr.width - size / 2,
                cy: y + pbcr.height / 2,
                radius: size / 2,
              };
              const pct = parseFloat(getPercentage(percentageString)) / 100.0;
              if (percentageString.endsWith("%")) {
                let color = "#dc322fFF"; // Solarized red
                if (pct >= 0.4) {
                  color = "#b58900FF"; // Solarized yellow
                }
                if (pct >= 0.8) {
                  color = "#859900FF"; // Solarized green
                }
                props.color = color;
                createPercentagePieChart(n, 100 * pct, props);
              }
            }
            interact(n).on("hold", (ev) => {
              n.held = true;
              ev.preventDefault();
              ev.stopPropagation();
              ev.stopImmediatePropagation();
              if (ev.button != 0) {
                // Want to avoid right-click-menu counting as hold, very annoying
                return;
              }
              ev.preventDefault();
              ev.stopPropagation();
              ev.stopImmediatePropagation();
              div.mark.unmark();
              div.mark.mark(titleObj, { accuracy: "exactly" });
            });
            if (title.includes("🟨") || title.includes("✅")) {
              const id = n.closest("g").id;
              const xmlns = "http://www.w3.org/2000/svg"; // SVG namespace URI
              const tspan = document.createElementNS(xmlns, "tspan");
              tspan.classList.add("fawesome");
              if (title.startsWith("🟨")) {
                // Open checkbox case
                tspan.innerHTML = ""; // fontawesome glyph for open checkbox. For some reason unicode was not working
                tspan.checked = false;
                n.querySelector("text").textContent = title.replace("🟨", "");
                n.querySelector("text").prepend(tspan);
                n.classList.remove("crossed");
              }
              if (title.startsWith("✅")) {
                // Closed checkbox case
                tspan.innerHTML = ""; // fontawesome glyph for open checkbox. For some reason unicode was not working
                tspan.checked = true;
                n.querySelector("text").textContent = title.replace("✅", "");
                n.querySelector("text").prepend(tspan);
                n.classList.add("crossed");
              }
              tspan.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();
                if (!tspan.checked) {
                  tspan.innerHTML = ""; // fontawesome glyph for closed checkbox
                  n.classList.add("crossed");
                  for (let node of cmap.childNodes) {
                    const regex = new RegExp(`.*id\\s*=\\s*"${id}".*`);
                    if (regex.test(node.textContent)) {
                      node.textContent = node.textContent
                        .replace("[]", "[X]")
                        .replace("[ ]", "[X]");
                    }
                  }
                } else {
                  tspan.innerHTML = ""; // fontawesome glyph for open checkbox
                  n.classList.remove("crossed");
                  for (let node of cmap.childNodes) {
                    const regex = new RegExp(`.*id\\s*=\\s*"${id}".*`);
                    if (regex.test(node.textContent)) {
                      node.textContent = node.textContent
                        .replace("[x]", "[ ]")
                        .replace("[X]", "[ ]");
                    }
                  }
                }
                tspan.checked = !tspan.checked;
              });
            }
          });

          gvPanel.panzoom = svgPanZoom(
            document
              .getElementById(container.graphvizDestination, {
                zoomScaleSensitivity: 1.5,
              })
              .querySelector("svg"),
            {
              controlIconsEnabled: true,
              dblClickZoomEnabled: false,
              preventMouseEventsDefault: false,
            },
          );

          if (pan) {
            // Beware of order!
            gvPanel.panzoom.zoom(zoom);
            gvPanel.panzoom.pan(pan);
          }
          div.addEventListener("dblclick", (ev) => {
            const svgString = new XMLSerializer().serializeToString(
              document.getElementById(container.graphvizDestination),
            );
            const svgDataUri = "data:image/svg+xml;base64," + btoa(svgString);
            const downloadLink = document.createElement("a");
            downloadLink.href = svgDataUri;
            downloadLink.download = "cmap.svg";
            downloadLink.click();
          });
        } else {
          container.err = rendered;
        }
      } catch (err) {
        const reloadWorthyErrors = [
          "Out of bounds call_indirect",
          "memory access out of bounds",
          "call_indirect to a signature that does not match",
          "table index is out of bounds",
        ];
        const isReloadWorthy = reloadWorthyErrors.some((string) =>
          err.message.includes(string),
        );
        if (err instanceof Error && isReloadWorthy) {
          weave.graphviz = await Graphviz.load();
          return;
        }
        document.getElementById(container.errorDestination).innerHTML = err;
      }
    };
    if (!container.dot) {
      container.render = render;
      container.addEventListener("keydown", () => {
        container.render();
      });
    }
    render();
    toRight(gvPanel);
  },
  description: "Graphviz based on gh/hpcc-systems/hpcc-js-wasm",
  el: "u",
};

// Experimental

function createPercentagePieChart(container, percentage, props = {}) {
  // Background circle (optional)
  let color = props.color || "blue";
  let cx = props.cx || 50;
  let cy = props.cy || 50;
  let radius = props.radius || 40;
  const background = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  background.setAttribute("cx", cx); // Use provided cx
  background.setAttribute("cy", cy); // Use provided cy
  background.setAttribute("r", 1.03 * radius); // Use provided radius
  background.setAttribute("fill", "midnightblue");
  background.setAttribute("stroke", "#c60");
  container.appendChild(background);

  const angle = -Math.PI / 2 + (percentage / 100) * 2 * Math.PI;

  // Calculate starting point at 12 o'clock
  const x1 = cx + radius * Math.cos(-Math.PI / 2);
  const y1 = cy + radius * Math.sin(-Math.PI / 2);

  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);

  // Corrected arc flags
  const largeArcFlag = percentage > 50 ? 1 : 0;
  const sweepFlag = 1;

  const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${x} ${y} L ${cx} ${cy} Z`; // Updated pathData

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", color);
  container.appendChild(path);
}
