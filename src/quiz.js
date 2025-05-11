import { fsrs, createEmptyCard, Rating } from "../lib/fsrs.js";

const fsrsInstance = fsrs({});

if (typeof window.quizFSRS === "undefined") {
  window.quizFSRS = {};
}

let fsrsStorageTextElementId = null;

window.quizEnabled = false;
let currentQuizElement = null;
let currentQuizItemId = null;
let quizTextHolder = null;
let originalVisibility = "";
let originalTextContent = "";
let graphContainerId = "";
let quizInputElement = null;
let isShowingAnswer = false;
let highlightCircle = null;
let boundGlobalKeydownHandler = null;

function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const getItemId = (graphElement) => {
  if (!graphElement) return null;
  const titleElement = graphElement.querySelector("title");
  return titleElement ? titleElement.textContent.trim() : null;
};

const getTextElementAndContent = (graphElement) => {
  if (!graphElement) return { element: null, content: null };
  let textElement = graphElement.querySelector("text");
  if (
    textElement &&
    textElement.textContent &&
    textElement.textContent.trim() !== ""
  ) {
    return { element: textElement, content: textElement.textContent.trim() };
  }
  return { element: null, content: null };
};

const clearHighlighting = (element) => {
  if (!element) return;
  if (highlightCircle && highlightCircle.parentNode === element) {
    element.removeChild(highlightCircle);
  }
  element.style.stroke = "";
  element.style.strokeWidth = "";
};

const mapIntToRating = (ratingInt) => {
  switch (ratingInt) {
    case 1:
      return Rating.Again;
    case 2:
      return Rating.Hard;
    case 3:
      return Rating.Good;
    case 4:
      return Rating.Easy;
    default:
      console.error("Invalid rating integer:", ratingInt);
      return Rating.Good;
  }
};

const generateFsrsCommentBlock = () => {
  let jsonString;
  if (
    typeof window.quizFSRS === "undefined" ||
    Object.keys(window.quizFSRS).length === 0
  ) {
    jsonString = "{}";
  } else {
    try {
      jsonString = JSON.stringify(window.quizFSRS, null, 2);
    } catch (error) {
      console.error("Error stringifying FSRS data:", error);
      jsonString = '"Error: Could not serialize FSRS data."';
    }
  }
  return `/* FSRS SECTION\n${jsonString}\n*/`;
};

// Loads FSRS data from the specified contenteditable div
const loadFsrsDataFromTextElement = () => {
  if (!fsrsStorageTextElementId) {
    return;
  }
  const storageElement = document.getElementById(fsrsStorageTextElementId);
  if (!storageElement) {
    console.error(
      `Quiz: FSRS Storage Text Element with ID '${fsrsStorageTextElementId}' not found during load.`,
    );
    return;
  }

  const currentTextContent = storageElement.innerText;
  const fsrsSectionRegex = /\/\* FSRS SECTION\n([\s\S]*?)\n\*\//m;
  const match = currentTextContent.match(fsrsSectionRegex);

  if (match && match[1]) {
    const jsonContent = match[1].trim();
    try {
      const parsedData = JSON.parse(jsonContent);
      if (typeof parsedData === "object" && parsedData !== null) {
        window.quizFSRS = parsedData;
        console.log(
          "Quiz: FSRS data loaded successfully from element:",
          fsrsStorageTextElementId,
        );
      } else {
        console.error(
          "Quiz: Parsed FSRS data is not a valid object. Content:",
          jsonContent,
        );
      }
    } catch (error) {
      console.error(
        "Quiz: Error parsing FSRS JSON data from text element:",
        error,
        "\nContent was:",
        jsonContent,
      );
    }
  } else {
    console.warn(
      "Quiz: FSRS SECTION not found in text element during load. `window.quizFSRS` will remain as is (possibly empty).",
    );
  }
};

const updateFsrsDataInTextElement = () => {
  if (!fsrsStorageTextElementId) {
    return;
  }

  const storageElement = document.getElementById(fsrsStorageTextElementId);
  if (!storageElement) {
    console.error(
      `Quiz: FSRS Storage Text Element with ID '${fsrsStorageTextElementId}' not found during save.`,
    );
    return;
  }

  let currentTextContent = storageElement.innerText;
  const newFsrsBlock = generateFsrsCommentBlock();
  const fsrsSectionRegex = /\/\* FSRS SECTION\n[\s\S]*?\n\*\//m;

  let newTextContent;
  if (fsrsSectionRegex.test(currentTextContent)) {
    newTextContent = currentTextContent.replace(fsrsSectionRegex, newFsrsBlock);
  } else {
    newTextContent =
      currentTextContent +
      (currentTextContent.endsWith("\n") ||
      currentTextContent.endsWith("<br>") ||
      currentTextContent.endsWith("</div>")
        ? ""
        : "\n\n") +
      newFsrsBlock;
    console.warn(
      "Quiz: FSRS SECTION not found in element during save. Appending.",
    );
  }

  storageElement.innerText = newTextContent;
};

const handleRating = (ratingInt) => {
  if (!currentQuizItemId || !window.quizFSRS[currentQuizItemId]) {
    console.error(
      "FSRS Error: No card data found for current item ID:",
      currentQuizItemId,
    );
    startNewQuestion();
    return;
  }

  const cardInfo = window.quizFSRS[currentQuizItemId];
  const now = new Date();
  const fsrsRating = mapIntToRating(ratingInt);

  console.log(
    `Quiz: Item '${currentQuizItemId}' rated as ${Rating[fsrsRating]} (Value: ${ratingInt})`,
  );

  const schedules = fsrsInstance.repeat(cardInfo, now);

  if (schedules && schedules[fsrsRating] && schedules[fsrsRating].card) {
    window.quizFSRS[currentQuizItemId] = schedules[fsrsRating].card;
  } else {
    console.error(
      `FSRS Error: Could not get schedule for rating ${Rating[fsrsRating]}. Schedules:`,
      schedules,
      "Card:",
      cardInfo,
    );
  }

  startNewQuestion();
};

const startNewQuestion = () => {
  if (currentQuizElement) {
    if (quizTextHolder) {
      quizTextHolder.style.opacity = originalVisibility || "1";
    }
    clearHighlighting(currentQuizElement);
  }
  highlightCircle = null;
  currentQuizElement = null;
  currentQuizItemId = null;
  isShowingAnswer = false;

  if (quizInputElement) {
    quizInputElement.innerHTML = "";
    quizInputElement.style.display = "none";
  }

  const graphContainer = document.getElementById(graphContainerId);
  if (!graphContainer) {
    console.error(
      `Quiz: Graph container with id "${graphContainerId}" not found.`,
    );
    if (quizInputElement) {
      quizInputElement.textContent = `Error: Graph container "${graphContainerId}" not found.`;
      quizInputElement.style.display = "block";
    }
    return;
  }

  const allElements = Array.from(
    graphContainer.querySelectorAll("g.node, g.edge"),
  );
  const potentialQuizItems = allElements.filter((el) => {
    const id = getItemId(el);
    const { content } = getTextElementAndContent(el);
    return id && content && content.length > 0;
  });

  if (potentialQuizItems.length === 0) {
    if (quizInputElement) {
      quizInputElement.innerHTML =
        "No quiz-able items (nodes/edges with ID and text labels) found.";
      quizInputElement.style.display = "block";
      quizInputElement.setAttribute("contentEditable", "false");
    }
    return;
  }

  const now = new Date();
  let dueItems = [];
  let newItems = [];

  potentialQuizItems.forEach((item) => {
    const id = getItemId(item);
    if (!id) return;

    if (!window.quizFSRS[id]) {
      newItems.push(item);
    } else {
      const card = window.quizFSRS[id];
      const dueDate =
        typeof card.due === "string" ? new Date(card.due) : card.due;
      console.log(dueDate);
      if (dueDate instanceof Date && !isNaN(dueDate) && dueDate <= now) {
        dueItems.push(item);
      } else if (!(dueDate instanceof Date) || isNaN(dueDate)) {
        console.warn(
          `Invalid due date for item ${id}:`,
          card.due,
          "- treating as new.",
        );
        newItems.push(item);
        delete window.quizFSRS[id];
      }
    }
  });

  let selectedItem = null;
  if (dueItems.length > 0) {
    selectedItem = dueItems[Math.floor(Math.random() * dueItems.length)];
  } else if (newItems.length > 0) {
    selectedItem = newItems[Math.floor(Math.random() * newItems.length)];
  } else {
    if (quizInputElement) {
      quizInputElement.innerHTML =
        "Nothing to review right now! All items are up-to-date.";
      quizInputElement.style.display = "block";
      quizInputElement.setAttribute("contentEditable", "false");
    }
    return;
  }

  currentQuizElement = selectedItem;
  currentQuizItemId = getItemId(currentQuizElement);

  if (!currentQuizItemId) {
    console.error("Critical Error: Selected item has no ID.");
    startNewQuestion();
    return;
  }

  if (!window.quizFSRS[currentQuizItemId]) {
    window.quizFSRS[currentQuizItemId] = createEmptyCard(now);
  }

  const { element: textHolderElement, content: text } =
    getTextElementAndContent(currentQuizElement);

  if (!textHolderElement || !text) {
    console.error("Quiz: Selected element unexpectedly has no <text> content.");
    startNewQuestion();
    return;
  }

  quizTextHolder = textHolderElement;
  originalTextContent = text;
  originalVisibility = quizTextHolder.style.opacity || "1";
  quizTextHolder.style.opacity = "0";

  const bbox = currentQuizElement.getBBox();
  if (bbox && (bbox.width > 0 || bbox.height > 0)) {
    const newCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    newCircle.setAttribute("cx", String(bbox.x + bbox.width / 2));
    newCircle.setAttribute("cy", String(bbox.y + bbox.height / 2));
    const radius = Math.max(10, Math.max(bbox.width, bbox.height) / 2 + 10);
    newCircle.setAttribute("r", String(radius));
    newCircle.setAttribute("fill", "rgba(255, 0, 0, 0.1)");
    newCircle.setAttribute("stroke", "red");
    newCircle.setAttribute("stroke-width", "2.5");
    newCircle.setAttribute("pointer-events", "none");
    currentQuizElement.appendChild(newCircle);
    highlightCircle = newCircle;
  } else {
    currentQuizElement.style.stroke = "red";
    currentQuizElement.style.strokeWidth = "2px";
  }

  if (quizInputElement) {
    quizInputElement.innerHTML = "";
    quizInputElement.setAttribute("contentEditable", "true");
    quizInputElement.style.display = "block";
    quizInputElement.focus();
  }
};

const showAnswer = (userAnswer) => {
  if (!currentQuizElement || !quizTextHolder || originalTextContent === null) {
    console.warn("Quiz: Cannot show answer, state incomplete.");
    return;
  }

  quizTextHolder.style.opacity = originalVisibility;
  clearHighlighting(currentQuizElement);

  if (quizInputElement) {
    quizInputElement.setAttribute("contentEditable", "false");
    quizInputElement.innerHTML =
      `Your answer: <span style="color: dodgerblue; font-weight: bold;">${escapeHtml(userAnswer)}</span><br>` +
      `Correct answer: <span style="color: mediumseagreen; font-weight: bold;">${escapeHtml(originalTextContent)}</span><br><hr>`;

    const ratingsMap = {
      [Rating.Again]: { text: "Again (a, 1)", color: "#FF7675", value: 1 },
      [Rating.Hard]: { text: "Hard (r, 2)", color: "#FDCB6E", value: 2 },
      [Rating.Good]: { text: "Good (s, 3)", color: "#55EFC4", value: 3 },
      [Rating.Easy]: { text: "Easy (t, 4)", color: "#74B9FF", value: 4 },
    };

    const buttonContainer = document.createElement("div");
    buttonContainer.style.marginTop = "10px";
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "space-around";

    [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].forEach(
      (ratingKey) => {
        const ratingInfo = ratingsMap[ratingKey];
        const button = document.createElement("button");
        button.textContent = ratingInfo.text;
        button.style.padding = "8px 15px";
        button.style.border = "none";
        button.style.borderRadius = "5px";
        button.style.cursor = "pointer";
        button.style.backgroundColor = ratingInfo.color;
        button.style.color = "black";
        button.style.fontWeight = "bold";
        button.onclick = () => handleRating(ratingInfo.value);
        buttonContainer.appendChild(button);
      },
    );

    quizInputElement.appendChild(buttonContainer);
    quizInputElement.style.display = "block";
  }
  isShowingAnswer = true;
};

const cleanupQuizState = () => {
  if (currentQuizElement) {
    if (quizTextHolder) {
      quizTextHolder.style.opacity = originalVisibility;
    }
    clearHighlighting(currentQuizElement);
  }
  highlightCircle = null;

  if (quizInputElement) {
    quizInputElement.innerHTML = "";
    quizInputElement.style.display = "none";
    quizInputElement.setAttribute("contentEditable", "false");
  }
  currentQuizElement = null;
  currentQuizItemId = null;
  quizTextHolder = null;
  originalTextContent = "";
  originalVisibility = "";
  isShowingAnswer = false;
};

const globalKeydownHandler = (event) => {
  if (!window.quizEnabled) return;

  if (event.key === "Escape") {
    event.preventDefault();
    quiz(graphContainerId, fsrsStorageTextElementId)();
    return;
  }

  if (!quizInputElement) return;

  const quizInputIsForTyping =
    quizInputElement.style.display === "block" &&
    quizInputElement.getAttribute("contentEditable") === "true" &&
    !isShowingAnswer;

  if (event.target === quizInputElement && quizInputIsForTyping) {
    if (event.key === "Enter") {
      event.preventDefault();
      const userAnswer = quizInputElement.textContent;
      showAnswer(userAnswer);
    }
    return;
  }

  if (isShowingAnswer) {
    if (event.key === "Enter" || event.code === "Space") {
      event.preventDefault();
    }
    // Colemak layout shortcuts a, r, s, t
    if (event.key === "a" || event.key === "A") {
      // Again
      event.preventDefault();
      handleRating(1);
    } else if (event.key === "r" || event.key === "R") {
      // Hard
      event.preventDefault();
      handleRating(2);
    } else if (event.key === "s" || event.key === "S") {
      // Good
      event.preventDefault();
      handleRating(3);
    } else if (event.key === "t" || event.key === "T") {
      // Easy
      event.preventDefault();
      handleRating(4);
    }
    // Numeric shortcuts 1, 2, 3, 4
    else if (event.key >= "1" && event.key <= "4") {
      event.preventDefault();
      handleRating(parseInt(event.key));
    }
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    startNewQuestion();
  }
};

const quiz = (targetDivId, storageElementIdForFsrs) => () => {
  const currentTargetDivId = targetDivId;
  const currentFsrsStorageId = storageElementIdForFsrs;

  window.quizEnabled = !window.quizEnabled;

  if (window.quizEnabled) {
    graphContainerId = currentTargetDivId;
    fsrsStorageTextElementId = currentFsrsStorageId || null;

    loadFsrsDataFromTextElement();

    quizInputElement = document.getElementById("quiz-input");

    if (!quizInputElement) {
      console.log('Quiz: "quiz-input" div not found, creating it.');
      quizInputElement = document.createElement("div");
      quizInputElement.id = "quiz-input";
      document.body.appendChild(quizInputElement);
    }

    console.log("Quiz enabled.");
    if (fsrsStorageTextElementId) {
    } else {
      console.warn(
        "Quiz: No FSRS storage element ID provided. FSRS data will not be saved back to any text field by this module.",
      );
    }

    cleanupQuizState();

    boundGlobalKeydownHandler = globalKeydownHandler;
    document.addEventListener("keydown", boundGlobalKeydownHandler);

    startNewQuestion();
  } else {
    console.log("Quiz disabled.");
    if (boundGlobalKeydownHandler) {
      document.removeEventListener("keydown", boundGlobalKeydownHandler);
      boundGlobalKeydownHandler = null;
    }

    updateFsrsDataInTextElement();

    cleanupQuizState();
  }
};

export { quiz };
