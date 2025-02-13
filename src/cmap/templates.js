export { headerT, solarizedColors, darkColors, lightColors, lateBinding };

const headerT = `
digraph G {
  layout="dot"
  margin="0.5"
  bgcolor="$BACKGROUNDCOLOR"
  rankdir="TB"
  fontname="main_fontname"
  fontcolor="$FONTCOLOR"
  nodesep="0.6"
  overlap="scale"
  compound="true"
  node [
    fontname = "main_fontname"
    style="rounded,filled"
    labelloc="c"
    margin="0.5,0.3"
    splines="true"
    shape="rect"
    fontsize="26"
    fillcolor="$NODEFILLCOLOR"
    color="$NODECOLOR"
    fontcolor="$FONTCOLOR"
  ];
  edge [
    minlen="3"
    penwidth="2"
    color="$EDGECOLOR"
    fontcolor="$FONTCOLOR"
    fontname="main_fontname"
      fontsize="22"
      arrowhead="normal" // Latest papers about cmaps have recovered heads
  ];
  graph [
    margin="8"
    style="rounded,dotted"
    fillcolor="$NODEFILLCOLOR"
    color="$NODECOLOR"
  ];
  fontsize="$TITLEFONTSIZE"
  fontname="$TITLEFONTNAME"
  labelloc="t";
  fontcolor="$TITLEFONTCOLOR"
  `;

const solarizedColors = `
- yellow: #b58900
- orange: #cb4b16
- red: #dc322f
- magenta: #d33682
- violet: #6c71c4
- blue: #268bd2
- cyan: #2aa198
- green: #859900
- yellow(FF): #b58900FF
- orange(FF): #cb4b16FF
- red(FF): #dc322fFF
- magenta(FF): #d33682FF
- violet(FF): #6c71c4FF
- blue(FF): #268bd2FF
- cyan(FF): #2aa198FF
- green(FF): #859900FF
- lightbackground(FF): #fdf6e3FF
`;

const solarizedFunColors = `

`;

const darkColors = `
$BASE03=#002B36FF
$BASE02=#073642FF
$BASE01=#586E75FF
$BASE0=#657B83FF
`;

const lightColors = `
$BASE03=#fdf6e3FF
$BASE02=#eee8d5FF
$BASE01=#93a1a1FF
$BASE0=#839496FF
$EDGECOLOR=#33333388
$NODECOLOR=#000000FF
$BACKGROUNDCOLOR=#FFFFFFFF
$NODEFILLCOLOR=$BACKGROUNDCOLOR
$FONTCOLOR=#000000FF
`;

// These are replacements that are only used as fallbacks, so they also get themselves replaced when used.
// Since red=cyan or similar would be an error, they are wrapped in a comment.

const lateBinding = `
/*
- main_fontname: roboto
$TITLEFONTCOLOR=$FONTCOLOR
$TITLEFONTSIZE=38
$TITLEFONTNAME=main_fontname
$EDGECOLOR=orange
$NODECOLOR=$BASE0
$BACKGROUNDCOLOR=$BASE03
$NODEFILLCOLOR=$BACKGROUNDCOLOR
$FONTCOLOR=cyan
$CHECKBOXES=orange
$CROSSED=orange
*/
`;
