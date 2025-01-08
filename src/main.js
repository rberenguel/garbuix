import { cmapRender } from "./cmap.js";
import { graphvizRender } from "./graphviz.js";

const d = () => document.createElement("DIV");
const container = document.getElementById("container");

const cmapContainer = d();
cmapContainer.contentEditable = true;
cmapContainer.id = "cmap";
cmapContainer.classList.add("source-code", "item");
container.appendChild(cmapContainer);

cmapContainer.innerText = `
# foo [calc]
$DARK
A -> +_B 4
C -> +_B 5
+_B sum
x -> &&_z 90%
y -> &&_z 30%
&&_z and
n -> *=_m 5
*=_m carry-mul
*=_m -> :=_foo 1.27
:=_foo foo
`;

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

const metaP = () => {
  const items = Array.from(document.querySelectorAll(".item"));
  const gcsd = (d) => window.getComputedStyle(d).display;
  const hidden = items.filter((d) => gcsd(d) === "none");
  console.log();

  modal.innerHTML = "";
  hidden.map((d) => {
    const p = document.createElement("P");
    p.innerText = d.id;
    p.classList.add("modal-row");
    p.style.display = "block";
    modal.appendChild(p);
  });
  if (modal.style.display === "block") {
    modal.style.display = "none";
  } else {
    modal.style.display = "block";
  }
};

async function handleFileSelection(file) {
  // Check if a file was selected
  if (file) {
    console.log("File selected:", file.name);

    // Read the file contents
    const fileReader = new FileReader();
    fileReader.onload = (event) => {
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
    console.log("No file selected.");
  }
}

async function openFile() {
  try {
    // Request file access permission (if not already granted)
    const [fileHandle] = await window.showOpenFilePicker();

    // Get the file from the file handle
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
    const fileHandle = await window.showSaveFilePicker(options);
    const writable = await fileHandle.createWritable();
    await writable.write(fileContent);
    await writable.close();

    console.log("File saved successfully.");
  } catch (error) {
    console.error("Error saving file:", error);
  }
}

document.body.addEventListener("keydown", async (ev) => {
  const oldp = window.print;
  window.print = null;
  if (ev.key === "p" && ev.metaKey) {
    console.log("M p");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    metaP();
    return;
  }
  if (ev.key === "s" && ev.metaKey) {
    console.log("M s");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    await saveFile();
    return;
  }
  if (ev.key === "o" && ev.metaKey) {
    console.log("M o");
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    await openFile();
    await render();
    return;
  }
  if (ev.key === "e" && ev.metaKey) {
    console.log("M e");
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
  if (ev.key === "g" && ev.metaKey) {
    console.log("M g");
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
      putInFront(vizP[0].textContent);
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
  console.log("Launch params:", launchParams);
  if (launchParams.files.length > 0) {
    console.log("Got file(s)");
    const fileHandle = launchParams.files[0];

    const file = await fileHandle.getFile();

    if (file) {
      console.log("File opened:", file.name);
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
      console.log("No file opened.");
    }
  }
}

// Check if launched from file open and handle the file
if ("launchQueue" in window) {
  console.log("Launch queue");
  launchQueue.setConsumer(handleOpenedFile);
}
