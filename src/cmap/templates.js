export { headerT, solarizedColors, darkColors, lightColors, lateBinding };

const headerT = `
digraph G {
  layout="dot"
  margin="0.5"
  bgcolor="$BACKGROUNDCOLOR"
  rankdir="TB"
  fontname="$FONTNAME"
  fontcolor="$FONTCOLOR"
  nodesep="0.6"
  overlap="scale"
  compound="true"
  node [
    fontname = "$FONTNAME"
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
    fontname="$FONTNAME"
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
$YELLOW=#b58900FF
$ORANGE=#cb4b16FF
$RED=#dc322fFF
$MAGENTA=#d33682FF
$VIOLET=#6c71c4FF
$BLUE=#268bd2FF
$CYAN=#2aa198FF
$GREEN=#859900FF
$LIGHTBACKGROUND=#fdf6e3FF
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
$FONTNAME=roboto
$TITLEFONTCOLOR=$FONTCOLOR
$TITLEFONTSIZE=38
$TITLEFONTNAME=$FONTNAME
$EDGECOLOR=$ORANGE
$NODECOLOR=$BASE0
$BACKGROUNDCOLOR=$BASE03
$NODEFILLCOLOR=$BACKGROUNDCOLOR
$FONTCOLOR=$CYAN
*/
`;
