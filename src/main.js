import { cmapRender } from "./cmap.js";
import { graphvizRender } from "./graphviz.js";

import { jazz } from "./jazz/jazz.js";

import { del, set, get, entries } from "../lib/idb-keyval.js";

const d = () => document.createElement("DIV");
const container = document.getElementById("container");

const cmapContainer = d();
cmapContainer.contentEditable = true;
cmapContainer.id = "cmap";
cmapContainer.classList.add("source-code", "item");
container.appendChild(cmapContainer);

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

/*`# foo [calc]
$DARK

$TITLEFONTCOLOR=red
foo [ ] foo
.=_a A
w -> .=_a 5
`
*/
/*
`
`;
*/

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

const render = async () => {
  const gv = cmapRender(cmapContainer);
  graphvizSourceContainer.innerHTML = "";
  //graphvizSourceContainer.innerText = gv;
  const nums = d();
  const wrapper = d();
  wrapper.style = "display: flex;";
  nums.classList.add("line-numbers");
  graphvizSourceContainer.appendChild(wrapper);
  const source = d();
  wrapper.appendChild(nums);
  const lines = gv.split("\n").filter(Boolean);
  nums.innerHTML = lines
    .concat(lines)
    .map((_, i) => `<div>${i + 1}</div>`)
    .join("");
  wrapper.appendChild(source);
  source.innerText = gv;
  await graphvizRender(gv, cmapContainer, renderedContainer, errorsContainer);
};

cmapContainer.addEventListener("keyup", async (ev) => {
  await render();
  if (cmapContainer.mark) {
    cmapContainer.mark.unmark();
  }
});

cmapContainer.addEventListener("keydown", async (ev) => {
  await render();
  if (cmapContainer.mark) {
    cmapContainer.mark.unmark();
  }
});

cmapContainer.addEventListener("input", async (ev) => {
  await render();
  if (cmapContainer.mark) {
    cmapContainer.mark.unmark();
  }
});

cmapContainer.addEventListener("click", (ev) => {
  if (cmapContainer.mark) {
    cmapContainer.mark.unmark();
  }
});

// For some reason insisting makes it work better.
// Hence all the listeners.

document.addEventListener("DOMContentLoaded", async () => {
  await render();
});

let searchText = "";
const modal = document.getElementById("modal");

const commands = [
  {
    title: "main example",
    lambda: async () => {
      const def = await loadFile("./examples/main-example.cmap");
      cmapContainer.innerText = def;
      await render();
    },
  },
  {
    title: "jazz",
    lambda: jazz,
  },
];

const toggleModal = () => {
  if (modal.style.display === "block") {
    modal.style.display = "none";
  } else {
    modal.style.display = "block";
  }
};

const metaP = () => {
  modal.innerHTML = "";
  commands.map((d) => {
    const p = document.createElement("P");
    p.innerText = d.title;
    p.classList.add("modal-row");
    p.style.display = "block";
    p.addEventListener("click", () => {
      d.lambda();
      toggleModal();
    });
    p.lambda = d.lambda;
    modal.appendChild(p);
  });
  toggleModal();
};

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
    // Handle errors (e.g., user cancels the dialog)
    console.error("Error opening file:", error);
    // Trying alternate method…
    filePicker.click();
  }
}

const putInFront = (divId) => {
  const itemToMove = document.getElementById(divId);
  container.insertBefore(itemToMove, container.firstChild);
};

async function saveFile() {
  try {
    const options = {
      suggestedName: "diagram.cmap",
      types: [{}],
    };
    const fileContent = cmapContainer.innerText;
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
  } catch (error) {
    console.error("Error saving file:", error);
    const fileBlob = new Blob([cmapContainer.innerText], {
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
  }
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
  const oldp = window.print;
  window.print = null;
  // The only valid use of "platform" is to choose this, actually
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const cmd = isMac ? ev.metaKey : ev.ctrlKey;
  if (ev.key === "Backspace") {
    window.beforeDeletion = cmapContainer.innerText;
  }
  if (ev.key === "p" && cmd) {
    console.info("M p");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    metaP();
    return;
  }
  if (ev.key === "s" && cmd) {
    console.info("M s");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    await saveFile();
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
    } else {
      putInFront("graphviz");
      putInFront("cmap");
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

  if (modal.style.display === "block") {
    console.info("modal visible, stopping propagation");
    ev.preventDefault();
    ev.stopPropagation();
    const ps = Array.from(modal.querySelectorAll("P"));
    if (ev.key === "Backspace") {
      searchText = searchText.slice(0, -1);
    } else if (ev.key === "Escape") {
      searchText = "";
      modal.style.display = "none";
    } else if (ev.key === "Enter") {
      const vizP = ps.filter((p) => p.style.display === "block");
      if (vizP.length === 0) {
        searchText = "";
        modal.style.display = "none";
        return;
      }
      vizP[0].lambda();
      searchText = "";
      modal.style.display = "none";
    } else if (ev.key.length === 1) {
      searchText += ev.key;
      const matches = ps.filter((p) =>
        p.textContent.toLowerCase().includes(searchText),
      );
      ps.map((p) => (p.style.display = "none"));
      matches.map((p) => (p.style.display = "block"));
    }
  }
};

document.body.addEventListener("keyup", keyup);
document.body.addEventListener("keydown", keydown);

async function handleOpenedFile(launchParams) {
  if (launchParams.files.length > 0) {
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

// Check if launched from file open and handle the file
if ("launchQueue" in window) {
  launchQueue.setConsumer(handleOpenedFile);
}

const helpModal = document.getElementById("help-modal");

const help = document.getElementById("help-button");

const helpModalToggle = () => {
  if (helpModal.style.display === "block") {
    helpModal.style.display = "none";
  } else {
    helpModal.style.display = "block";
  }
};

help.addEventListener("click", (ev) => {
  helpModalToggle();
});

helpModal.addEventListener("click", helpModalToggle);

const init = async () => {
  let handle = await get("file");
  const urlLoadParam = new URLSearchParams(window.location.search).get("url");
  const urlViewParam = new URLSearchParams(window.location.search).get("view");
  const urlLoad = urlLoadParam || urlViewParam;
  if (handle) {
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
    // Since this graph is relatively large, loading it puts it in a weird place. This should be good enough,
    // and could actually be a good default when loading files.
  }
  const gvp = document.getElementById("graphviz").panzoom;
  gvp.zoom(0.5);
  setTimeout(() => gvp.pan(-1500, -1500), 100);

  if (urlViewParam) {
    document.body.removeEventListener("keyup", keyup);
    document.body.removeEventListener("keydown", keydown);
    // Since I rely on events on the div to refresh the graph, I can't really make it
    // invisible or undisplayed here.
    cmapContainer.style.width = "0";
    cmapContainer.style.padding = "0";
    cmapContainer.style.margin = "0";
    document.getElementById("view-only").innerHTML =
      `<span style="font-size: 110%; margin-bottom: 1em;">&#9888; Garbuix is currently in view-only mode</span><br/><hr/>The url parameter is<br/><code>view=${urlViewParam}</code><br/>If you want to be able to edit, please use the url parameter<br/><code>url=${urlViewParam}</code>`;
  }
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
