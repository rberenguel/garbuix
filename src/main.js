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
      const def = await loadFile("../examples/main-example.cmap");
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
  }
}

document.body.addEventListener("keyup", async (ev) => {
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
});

document.body.addEventListener("keydown", async (ev) => {
  const oldp = window.print;
  window.print = null;
  if (ev.key === "Backspace") {
    window.beforeDeletion = cmapContainer.innerText;
  }
  if (ev.key === "p" && ev.metaKey) {
    console.info("M p");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    metaP();
    return;
  }
  if (ev.key === "s" && ev.metaKey) {
    console.info("M s");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    await saveFile();
    return;
  }
  if (ev.key === "o" && ev.metaKey) {
    console.info("M o");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    await openFile();
    await render();
    return;
  }
  if (ev.key === "e" && ev.metaKey) {
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
  if ((ev.key === "n" && ev.metaKey) || (ev.key === "n" && ev.ctrlKey)) {
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
  if (ev.key === "g" && ev.metaKey) {
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
});

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
    const def = await loadFile("../examples/main-example.cmap");
    cmapContainer.innerText = def;
    await render();
    // Since this graph is relatively large, loading it puts it in a weird place. This should be good enough,
    // and could actually be a good default when loading files.
  }
  document.getElementById("graphviz").panzoom.zoom(0.5);
  document.getElementById("graphviz").panzoom.pan({ x: -250, y: -500 });
};

init();
