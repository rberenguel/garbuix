import { metaP } from "./metap.js";

import { cmapRender } from "./cmap.js";
import { graphvizRender } from "./graphviz.js";

import { jazz } from "./jazz/jazz.js";
import { quiz } from "./quiz.js";
import { del, set, get, entries } from "../lib/idb-keyval.js";
import { Completions } from "./completion.js";
import { predefinedKeys } from "./cmap/templates.js";

const d = () => document.createElement("DIV");
const container = document.getElementById("container");

const info = document.querySelector("#info");
const cmapContainer = d();
cmapContainer.contentEditable = true;
cmapContainer.spellcheck = false;
cmapContainer.id = "cmap";
cmapContainer.classList.add("source-code", "item");
container.appendChild(cmapContainer);

cmapContainer.titleMark = new Mark(cmapContainer);

const completions = new Completions(
  cmapContainer,
  document.getElementById("suggestions"),
);

interact("#cmap").resizable({
  edges: { left: false, right: true, bottom: false, top: false },

  listeners: {
    move(event) {
      // This still could be better, not smooth enough.
      let target = event.target;
      const rect = event.target.getBoundingClientRect();
      const w = parseFloat(target.getAttribute("data-w")) || rect.width;
      const computed = w + event.deltaRect.right;
      target.style.width = computed + "px";
      target.setAttribute("data-w", computed);
    },
  },
  modifiers: [
    interact.modifiers.restrictEdges({
      outer: "parent",
    }),

    interact.modifiers.restrictSize({
      min: { width: 100, height: 50 },
    }),
  ],

  inertia: true,
});

async function loadFile(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error("Error loading file:", error);
    // Handle the error appropriately (e.g., show an error message)
    return null;
  }
}

const graphvizSourceContainer = d();

graphvizSourceContainer.id = "source";
graphvizSourceContainer.classList.add("source-code", "item");

const errorsContainer = d();

errorsContainer.id = "errors";
errorsContainer.classList.add("source-code", "item");
document.body.appendChild(errorsContainer);

const renderedContainer = d();

renderedContainer.id = "graphviz";
renderedContainer.classList.add("item");

container.appendChild(renderedContainer);

container.appendChild(graphvizSourceContainer);
container.appendChild(errorsContainer);

const render = async (whom) => {
  console.info(`Rendering for ${whom}`);
  const rendered = cmapRender(cmapContainer);
  const conversion = rendered.conversion;
  const replacements = rendered.replacements;
  const nodes = rendered.nodes;
  graphvizSourceContainer.innerHTML = "";
  const nums = d();
  const wrapper = d();
  wrapper.style = "display: flex;";
  nums.classList.add("line-numbers");
  graphvizSourceContainer.appendChild(wrapper);
  const source = d();
  source.id = "underlying-graphviz-source";
  wrapper.appendChild(nums);
  const lines = conversion.split("\n").filter(Boolean);
  nums.innerHTML = lines
    .concat(lines)
    .map((_, i) => `<div>${i + 1}</div>`)
    .join("");
  wrapper.appendChild(source);
  source.innerText = conversion;
  source.lines = conversion;
  const allsuggestions = nodes
    .concat(predefinedKeys)
    .concat(Object.keys(replacements));
  completions.suggestionsList = []; // Temporarily disable completions. Not good [...new Set(allsuggestions)];
  await graphvizRender(
    { conversion: conversion, replacements: replacements },
    cmapContainer,
    renderedContainer,
    errorsContainer,
  );
};

const SKIP_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Meta",
  "Ctrl",
  "Alt",
];

let lastRender = -1000;

const markTitles = () => {
  cmapContainer.titleMark.markRegExp(/^\/\* # .*/gim, {
    element: "span",
    className: "h1cmap",
  });
  cmapContainer.titleMark.markRegExp(/^\/\* ## .*/gim, {
    element: "span",
    className: "h2cmap",
  });
  cmapContainer.titleMark.markRegExp(/^\/\* ### .*/gim, {
    element: "span",
    className: "h3cmap",
  });
};

cmapContainer.addEventListener("keyup", async (ev) => {
  if (cmapContainer.mark) {
    cmapContainer.mark.unmark();
  }
  if (SKIP_KEYS.includes(ev.key)) {
    return;
  }
  console.log(performance.now() - lastRender);
  await render("KeyUp");
  lastRender = performance.now();
  if (ev.key === "Enter") {
    //markTitles()
  }
});

cmapContainer.addEventListener("keydown", async (ev) => {
  completions.handleKeyDown(ev);
  if (cmapContainer.mark) {
    cmapContainer.mark.unmark();
  }
  if (SKIP_KEYS.includes(ev.key)) {
    return;
  }
  if (performance.now() - lastRender < 100) {
    return;
  }
  await render("KeyDown");
  lastRender = performance.now();
});

cmapContainer.addEventListener("input", async (ev) => {
  if (ev.inputType === "insertText") {
    completions.handleInput(ev.data); //Send the input
  } else if (ev.inputType === "insertParagraph") {
    completions.handleInput("\n");
    completions.hideSuggestions(); //  Hide suggestions on Enter
  } else if (ev.inputType === "deleteContentBackward") {
    //Backspace
    completions.handleInput("\b");
  } else {
    completions.handleInput(null); //Other events
  }

  //await render('Input');

  if (cmapContainer.mark) {
    cmapContainer.mark.unmark();
  }
});

cmapContainer.addEventListener("click", (ev) => {
  if (cmapContainer.mark) {
    cmapContainer.mark.unmark();
  }
  markTitles();
});

// For some reason insisting makes it work better.
// Hence all the listeners.

document.addEventListener("DOMContentLoaded", async () => {
  await render();
});

const viewOnly = (msg) => {
  document.body.removeEventListener("keyup", keyup);
  document.body.removeEventListener("keydown", keydown);
  // Since I rely on events on the div to refresh the graph, I can't really make it
  // invisible or undisplayed here.
  cmapContainer.style.width = "0";
  cmapContainer.style.padding = "0";
  cmapContainer.style.margin = "0";
  cmapContainer.style.border = "0";
  cmapContainer.style.borderRadius = "0";
  // In Safari, text from this still shows. So… kill it.
  cmapContainer.style.color = "var(--slighty-lighter-dark-background)";
  const vo = document.getElementById("view-only");
  vo.style.border = "1px solid #c60";
  vo.style.padding = "0.5em";
  vo.innerHTML = msg;
};

const exportToClipboard = async () => {
  const content = graphvizSourceContainer.querySelector(
    "#underlying-graphviz-source",
  ).lines;
  const text = new ClipboardItem({
    "text/plain": Promise.resolve(content).then(
      (text) => new Blob([text], { type: "text/plain" }),
    ),
  });
  navigator.clipboard
    .write([text])
    .then(() => console.info("Copied successfully"))
    .catch((err) => console.error(err));
};

const commands = [
  {
    title: "export to clipboard",
    lambda: exportToClipboard,
  },
  {
    title: "view only",
    lambda: () => {
      const msg = `<span style="font-size: 110%; margin-bottom: 1em;">&#9888; Garbuix is currently in view-only mode</span><br/><hr/>You did this. In an emergency, you can save from this help modal (clicking the command names).</code>`;
      viewOnly(msg);
    },
  },
  {
    title: "main example",
    lambda: async () => {
      const def = await loadFile("./examples/main-example.cmap");
      cmapContainer.innerText = def;
      await render();
    },
  },
  {
    title: "quiz",
    lambda: quiz("graphviz", "cmap"),
  },
  {
    title: "jazz",
    lambda: jazz,
  },
];

metaP.bind(commands);
document.addEventListener("keydown", (ev) => {
  if (ev.altKey & (ev.code === "KeyQ")) {
    ev.stopPropagation();
    ev.preventDefault();
    console.log("Quizzing");
    quiz("graphviz", "cmap")();
  }
});

async function handleFileSelection(file) {
  // Check if a file was selected
  if (file) {
    console.info("File selected:", file.name);

    // Read the file contents
    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      console.info("File loaded");
      const fileContents = event.target.result;
      cmapContainer.innerText = fileContents;
      // For some reason I need to wait here and also await a render
      // after opening the file :unamused:
      setTimeout(() => {
        const ev = new Event("keyup", { bubbles: true });
        cmapContainer.dispatchEvent(ev);
      }, 100);
    };
    fileReader.readAsText(file); // Read the file as text
  } else {
    console.info("No file selected.");
  }
}

async function verifyPermission(fileHandle) {
  const options = {};
  options.mode = "readwrite";
  // Check if permission was already granted. If so, return true.
  if ((await fileHandle.queryPermission(options)) === "granted") {
    return true;
  }
  // Request permission. If the user grants permission, return true.
  if ((await fileHandle.requestPermission(options)) === "granted") {
    return true;
  }
  // The user didn't grant permission, so return false.
  return false;
}

async function openFile() {
  try {
    // Request file access permission (if not already granted)
    const [fileHandle] = await window.showOpenFilePicker();
    verifyPermission(fileHandle);
    // Get the file from the file handle
    if (fileHandle) {
      await set("file", fileHandle);
    }
    const file = await fileHandle.getFile();

    // Process the selected file
    handleFileSelection(file);
  } catch (error) {
    if (error.name === "AbortError") {
      // Check for AbortError
      console.info("User cancelled file open.");
      return;
    } else {
      // Handle errors (e.g., user cancels the dialog)
      console.error("Error opening file:", error);
      // Trying alternate method…
      filePicker.click();
    }
  }
}

const putInFront = (divId) => {
  const itemToMove = document.getElementById(divId);
  container.insertBefore(itemToMove, container.firstChild);
  itemToMove.style.display = "block";
};

const hide = (divId) => {
  const itemToMove = document.getElementById(divId);
  //container.insertBefore(itemToMove, container.firstChild);
  itemToMove.style.display = "none";
};

const addPanZoom = (txt) => {
  const hasZoom = txt.includes("// zoom: ");
  let pastTitle = false;
  let lines = [];
  const zoom = renderedContainer.panzoom?.getZoom();
  const pan = renderedContainer.panzoom?.getPan();
  const newline = `// zoom: ${zoom} pan: ${pan.x} ${pan.y}`;
  if (zoom === undefined || pan === undefined) {
    return txt;
  }
  for (let line of txt.split("\n")) {
    if (pastTitle && !hasZoom) {
      lines.push("");
      lines.push(newline);
      lines.push("");
      pastTitle = false;
    }
    if (hasZoom && line.includes("// zoom: ")) {
      lines.push(newline);
      continue;
    }
    if (line.startsWith("# ")) {
      pastTitle = true;
    }
    lines.push(line);
  }
  return lines.join("\n");
};

async function saveFile() {
  const fileContent = addPanZoom(cmapContainer.innerText);
  try {
    const options = {
      suggestedName: "diagram.cmap",
      types: [{}],
    };

    let handle = await get("file");
    if (!handle) {
      handle = await window.showSaveFilePicker(options);
    }
    if (handle) {
      await set("file", handle);
    }
    const writable = await handle.createWritable();
    await writable.write(fileContent);
    await writable.close();
    console.info("File saved successfully.");
    info.innerHTML = "&#x1F4BE;";
    info.classList.add("fades");
  } catch (error) {
    if (error.name === "AbortError") {
      // Check for AbortError
      console.info("User cancelled file save.");
      return;
    } else {
      console.error("Error saving file:", error);
      console.info("Trying fallback in case this was due to being on iOS");
      const fileBlob = new Blob([fileContent], {
        type: "application/octet-stream;charset=utf-8",
      });
      const url = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "diagram.cmap";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      info.innerHTML = "&#x1F4BE;";
      info.classList.add("fades");
    }
  }
  setTimeout(() => {
    info.classList.remove("fades");
    info.innerText = "";
  }, 2000);
}

const keyup = async (ev) => {
  if (ev.key === "Backspace") {
    const current = cmapContainer.innerText;
    const before = window.beforeDeletion;
    const diff = before.length - current.length;
    if (diff / before.length > 0.5) {
      // If we have deleted more than 50%, consider it should go into a new file
      console.info(
        "You deleted more than 50%, this will go into a different file now",
      );
      await del("file");
    }
  }
};

const keydown = async (ev) => {
  console.log(ev);

  // The only valid use of "platform" is to choose this, actually: https://github.com/getsentry/sentry-javascript/issues/12127#issue-2306773462
  const isMac =
    /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const cmd = isMac ? ev.metaKey : ev.ctrlKey;
  if (ev.key === "Backspace") {
    window.beforeDeletion = cmapContainer.innerText;
  }

  if (ev.key === "s" && cmd) {
    console.info("M s");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    await saveFile();
    return;
  }
  if (ev.key === "c" && cmd && ev.shiftKey) {
    console.info("M S c");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    await exportToClipboard();
    return;
  }
  if (ev.key === "o" && cmd) {
    console.info("M o");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    await openFile();
    await render();
    return;
  }
  if (ev.key === "e" && cmd) {
    console.info("M e");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    if (container.children[0].id === "cmap") {
      putInFront("errors");
      putInFront("source");
      hide("graphviz");
      hide("cmap");
    } else {
      putInFront("graphviz");
      putInFront("cmap");
      hide("errors");
      hide("source");
    }
    return;
  }
  if (ev.key === "n" && cmd) {
    console.info("M n");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    cmapContainer.innerHTML = "";
    await del("file");
    await render();
    await render();
    return;
  }
  if (ev.key === "g" && cmd) {
    console.info("M g");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    if (container.children[0].id === "cmap") {
      putInFront("errors");
      putInFront("source");
    } else {
      putInFront("graphviz");
      putInFront("cmap");
    }
    return;
  }
};

document.body.addEventListener("keyup", keyup);
document.body.addEventListener("keydown", keydown);

const helpModal = document.getElementById("help-modal");
const glass = document.getElementById("glass");

const help = document.getElementById("help-button");

const helpModalToggle = () => {
  if (helpModal.style.display === "block") {
    helpModal.style.display = "none";
    glass.style.display = "none";
  } else {
    helpModal.style.display = "block";
    glass.style.display = "block";
  }
};

help.addEventListener("click", (ev) => {
  helpModalToggle();
});

helpModal.addEventListener("click", helpModalToggle);

let loadingFromLaunchParams = false;

async function handleOpenedFile(launchParams) {
  if (launchParams.files.length > 0) {
    loadingFromLaunchParams = true;
    const fileHandle = launchParams.files[0];

    const file = await fileHandle.getFile();

    if (file) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        const fileContents = event.target.result;
        cmapContainer.innerText = fileContents;
        setTimeout(() => {
          const ev = new Event("keyup", { bubbles: true });
          cmapContainer.dispatchEvent(ev);
        }, 100);
      };
      fileReader.readAsText(file);
    } else {
      console.info("No file opened.");
    }
  }
}

const init = async () => {
  // Check if launched from file open and handle the file
  if ("launchQueue" in window) {
    launchQueue.setConsumer(handleOpenedFile);
  }

  let handle = await get("file");
  const urlLoadParam = new URLSearchParams(window.location.search).get("url");
  const urlViewParam = new URLSearchParams(window.location.search).get("view");
  const urlLoad = urlLoadParam || urlViewParam;
  if (handle) {
    if (loadingFromLaunchParams) {
      return;
    }
    verifyPermission(handle);
    // Get the file from the file handle
    if (handle) {
      console.info("Got a handle from indexeddb");
      const file = await handle.getFile();
      handleFileSelection(file);
      setTimeout(() => {
        const ev = new Event("keyup", { bubbles: true });
        cmapContainer.dispatchEvent(ev);
      }, 100);
    }
  } else {
    if (loadingFromLaunchParams) {
      return;
    }
    let def;
    if (urlLoad) {
      const response = await fetch(urlLoad);
      if (response.ok) {
        def = await response.text();
      } else {
        def = await loadFile("./examples/main-example.cmap");
      }
    } else {
      def = await loadFile("./examples/main-example.cmap");
    }
    cmapContainer.innerText = def;
    await render();
    setTimeout(() => {
      const ev = new Event("keyup", { bubbles: true });
      cmapContainer.dispatchEvent(ev);
    }, 100);
  }
  const gvp = document.getElementById("graphviz").panzoom;
  gvp.zoom(0.5);
  const svg = document.getElementById("graphviz").querySelector("svg");
  const w = svg.width.baseVal.value;
  const h = svg.height.baseVal.value;
  try {
    gvp.pan({ x: -w / 10, y: -h / 10 }); // Weird magic numbers
  } catch (err) {
    console.log("Panzoom error");
    console.error(err);
  }

  if (urlViewParam) {
    const msg = `<span style="font-size: 110%; margin-bottom: 1em;">&#9888; Garbuix is currently in view-only mode</span><br/><hr/>The url parameter is<br/><code>view=${urlViewParam}</code><br/>If you want to be able to edit, please use the url parameter<br/><code>url=${urlViewParam}</code>`;
    viewOnly(msg);
  }
  // This timeout makes everything break in Safari for some reason.
  // It might be needed though for some cases in Chrome?
  /*setTimeout(() => {
    const ev = new Event("keyup", { bubbles: true });
    cmapContainer.dispatchEvent(ev);
  });*/
};

const openThing = document.getElementById("open-thing");
const saveThing = document.getElementById("save-thing");
const menuThing = document.getElementById("menu-thing");

const filePicker = document.getElementById("filePicker");

// Because on mobile I can't get a native filepicker to open as part of the PWA
filePicker.addEventListener("change", (event) => {
  const file = event.target.files[0];

  const reader = new FileReader();
  reader.readAsText(file, "UTF-8");

  reader.onload = (readerEvent) => {
    const content = readerEvent.target.result;
    cmapContainer.innerText = content;
    // For some reason I need to wait here and also await a render
    // after opening the file :unamused:
    setTimeout(() => {
      const ev = new Event("keyup", { bubbles: true });
      cmapContainer.dispatchEvent(ev);
    }, 100);
  };
});

openThing.addEventListener("click", async () => {
  await openFile();
  await render();
});

saveThing.addEventListener("click", async () => {
  await saveFile();
});

menuThing.addEventListener("click", async () => {
  metaP();
});

init();
