export { headerT, solarizedColors, darkColors, lightColors, lateBinding };

const headerT = `
digraph G {
  layout="dot"
  margin="0.5"
  bgcolor="background-color"
  rankdir="TB"
  fontname="main-fontname"
  fontcolor="main-fontcolor"
  nodesep="0.6"
  overlap="scale"
  compound="true"
  node [
    fontname = "main-fontname"
    style="rounded,filled"
    labelloc="c"
    margin="0.5,0.3"
    splines="true"
    shape="rect"
    fontsize="26"
    fillcolor="node-fillcolor"
    color="node-color"
    fontcolor="node-fontcolor"
  ];
  edge [
    minlen="3"
    penwidth="2"
    color="edge-color"
    fontcolor="edge-fontcolor"
    fontname="edge-fontname"
      fontsize="22"
      arrowhead="edge-arrowhead" // Latest papers about cmaps have recovered heads
  ];
  graph [
    margin="8"
    style="rounded,dotted"
    fillcolor="graph-fillcolor"
    color="graph-color"
    fontcolor="graph-fontcolor"
  ];
  fontsize="title-fontsize"
  fontname="title-fontname"
  labelloc="t";
  fontcolor="title-fontcolor"
  `;


// Note that if you have the same name for a lambda and
// a normal definition, lambda should go first

const solarizedColors = `
- sdyellow(FF): #b58900FF
- sdorange(FF): #cb4b16FF
- sdred(FF): #dc322fFF
- sdmagenta(FF): #d33682FF
- sdviolet(FF): #6c71c4FF
- sdblue(FF): #268bd2FF
- sdcyan(FF): #2aa198FF
- sdgreen(FF): #859900FF
- sdlightbackground(FF): #fdf6e3FF
- sdyellow: #b58900
- sdorange: #cb4b16
- sdred: #dc322f
- sdmagenta: #d33682
- sdviolet: #6c71c4
- sdblue: #268bd2
- sdcyan: #2aa198
- sdgreen: #859900
`;

const solarizedFunColors = `

`;

const darkColors = `
- sdbase03: #002B36FF
- sdbase02: #073642FF
- sdbase01: #586E75FF
- sdbase0: #657B83FF
`;

const lightColors = `
- base03: #fdf6e3FF
- base02: #eee8d5FF
- base01: #93a1a1FF
- base0: #839496FF
- edge-fillcolor: #33333388
- node-color: #000000FF
- background-color: #FFFFFFFF
- node-fillcolor: background-color
- main-fontcolor: #000000FF
`;

// These are replacements that are only used as fallbacks, so they also get themselves replaced when used.
// Since red=cyan or similar would be an error, they are wrapped in a comment.
// These do not cascade, are just a last resort

const lateBinding = `
/*
- main-fontname: roboto
- main-fontcolor: sdcyan
- background-color: sdbase03
- graph-color: sdcyan
- graph-fontcolor: sdorange
- graph-fillcolor: sdbase03
- title-fontcolor: sdcyan
- title-fontsize: 38
- title-fontname: roboto
- node-color: base0
- node-fillcolor: background-color
- node-fontcolor: sdcyan
- node-fontname: roboto
- edge-color: sdorange
- edge-fontcolor: sdcyan
- edge-fontname: roboto
- checkboxes-color: sdorange
- crossed-color: sdorange
*/
`;
