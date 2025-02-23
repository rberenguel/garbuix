// This was pretty much Gemini, with a lot of coercing (first it wanted to reparse the whole
// HTML structure…). It still needs work, it's a bit clunky. But at least there is no need to
// handle carets.

export class Completions {
  constructor(editor, suggestionsContainer, suggestionsList) {
    this.editor = editor;
    this.suggestionsContainer = suggestionsContainer;
    this.suggestionsList = suggestionsList;
    this.currentSuggestions = [];
    this.selectedSuggestionIndex = -1;
    this.currentWord = ""; // Store the current word being typed

    this.editor.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("click", this.handleClickOutside.bind(this));
  }

  handleInput(char) {
    if (char === "\n") {
      this.hideSuggestions();
      return;
    }
    this.updateCurrentWord(char); //Update the current word

    if (this.currentWord === "") {
      //If it's empty, hide
      this.hideSuggestions();
      return;
    }

    const filteredSuggestions = this.filterSuggestions(this.currentWord);
    this.showSuggestions(filteredSuggestions);
  }

  handleKeyDown(event) {
    if (event.metaKey || event.ctrlKey) {
      return;
    }
    if (this.suggestionsContainer.style.display === "block") {
      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        if (this.selectedSuggestionIndex > -1) {
          this.isInsertingSuggestion = true; // Set the flag
          for (let i = 0; i < this.currentWord.length; i++) {
            this.simulateKeypress(8);
          }
          this.simulateKeypresses(
            this.currentSuggestions[this.selectedSuggestionIndex],
          );
          this.clearCurrentWord();
          this.hideSuggestions();
          this.isInsertingSuggestion = false;
        } else if (this.currentSuggestions.length > 0) {
          this.isInsertingSuggestion = true; // Set the flag
          for (let i = 0; i < this.currentWord.length; i++) {
            this.simulateKeypress(8);
          }
          this.simulateKeypresses(this.currentSuggestions[0]);
          this.clearCurrentWord();
          this.hideSuggestions();
          this.isInsertingSuggestion = false;
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.selectedSuggestionIndex = Math.max(
          0,
          this.selectedSuggestionIndex - 1,
        );
        this.highlightSuggestion();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        this.selectedSuggestionIndex = Math.min(
          this.currentSuggestions.length - 1,
          this.selectedSuggestionIndex + 1,
        );
        this.highlightSuggestion();
      } else if (event.key === "Escape") {
        this.hideSuggestions();
        this.clearCurrentWord(); // Clear on Escape
      }
    }
    // Clear currentWord on space or enter, *even* if suggestions aren't shown
    if (event.key === "Enter" || event.key === " " || event.key === "=") {
      this.clearCurrentWord();
    }
  }

  handleClickOutside(event) {
    if (
      !this.editor.contains(event.target) &&
      !this.suggestionsContainer.contains(event.target)
    ) {
      this.hideSuggestions();
      this.clearCurrentWord(); // Clear on click outside
    }
  }

  updateCurrentWord(char) {
    if (this.isInsertingSuggestion) {
      return;
    }
    if (char === " " || char === "\n" || char === null) {
      //Added Null for "insertParagraph", etc
      this.clearCurrentWord();
    } else if (char.length > 1) {
      return; //ingore other control characters
    } else if (char === "\b") {
      //Backspace
      this.currentWord = this.currentWord.slice(0, -1); //removes last
    } else {
      // You can customize this to allow only certain characters
      const allowedChars = /^[a-zA-Z0-9]+$/; // Example: letters and numbers
      if (allowedChars.test(char)) {
        this.currentWord += char;
      }
    }
  }

  clearCurrentWord() {
    this.currentWord = "";
  }

  filterSuggestions(currentWord) {
    if (currentWord.length < 2) {
      return [];
    }
    return this.suggestionsList.filter((suggestion) =>
      suggestion.toLowerCase().startsWith(currentWord.toLowerCase()),
    );
  }

  showSuggestions(filteredSuggestions) {
    this.suggestionsContainer.innerHTML = "";
    this.currentSuggestions = filteredSuggestions;
    this.selectedSuggestionIndex = -1;

    if (filteredSuggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    filteredSuggestions.forEach((suggestion) => {
      const suggestionDiv = document.createElement("div");
      suggestionDiv.textContent = suggestion;
      // Adding a click handler would be interesting, but that would put it in the wrong place
      // unless we kept track of the selection, etc. Too much work for a use case I don't expect
      this.suggestionsContainer.appendChild(suggestionDiv);
    });
    this.suggestionsContainer.style.display = "block";
  }

  hideSuggestions() {
    this.suggestionsContainer.style.display = "none";
    this.currentSuggestions = [];
    this.selectedSuggestionIndex = -1;
    this.isInsertingSuggestion = false;
  }
  simulateKeypresses(text) {
    for (let char of text) {
      const keyCode = char.charCodeAt(0);
      this.simulateKeypress(keyCode, char);
    }
  }

  simulateKeypress(keyCode, char = null) {
    const key = String.fromCharCode(keyCode);

    // --- KEYDOWN ---
    const keydownEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: key,
      code: char ? `Key${char.toUpperCase()}` : `Backspace`,
      keyCode: keyCode,
      charCode: keyCode,
      which: keyCode,
      view: window,
    });
    //this.editor.dispatchEvent(keydownEvent);

    // --- INPUT (with Selection Management) ---
    setTimeout(() => {
      // Use setTimeout for event ordering
      this.isInsertingSuggestion = true;
      const selection = window.getSelection();
      const range =
        selection.rangeCount > 0
          ? selection.getRangeAt(0)
          : document.createRange();

      if (char) {
        // Insert character
        range.deleteContents(); // Clear any existing selection
        range.insertNode(document.createTextNode(char));
        range.collapse(false); // Move caret to end of inserted text

        // Dispatch Input Event AFTER setting range
        const inputEvent = new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: char,
        });

        selection.removeAllRanges();
        selection.addRange(range);
        this.editor.dispatchEvent(inputEvent);
      } else if (keyCode === 8) {
        // Backspace
        // Move the range to before the previous character, if possible
        if (range.startOffset > 0) {
          range.setStart(range.startContainer, range.startOffset - 1);
        } else if (range.startContainer.previousSibling) {
          // Handle moving to the previous node
          range.setStart(
            range.startContainer.previousSibling,
            range.startContainer.previousSibling.textContent.length,
          );
        }
        range.deleteContents(); //Very important! Deletes at range

        // Dispatch Input Event AFTER setting range
        const inputEvent = new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "deleteContentBackward",
        });

        selection.removeAllRanges();
        selection.addRange(range);
        this.editor.dispatchEvent(inputEvent);
      }

      // --- KEYUP ---
      const keyupEvent = new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        key: key,
        code: char ? `Key${char.toUpperCase()}` : `Backspace`,
        keyCode: keyCode,
        charCode: keyCode,
        which: keyCode,
        view: window,
      });

      selection.removeAllRanges(); // Very important!
      selection.addRange(range); // Restore selection
      //this.editor.dispatchEvent(keyupEvent);
    }, 0);
  }

  highlightSuggestion() {
    const suggestionDivs = this.suggestionsContainer.querySelectorAll("div");
    suggestionDivs.forEach((div, index) => {
      if (index === this.selectedSuggestionIndex) {
        div.style.backgroundColor = "rgba(50, 50, 50, 0.7)";
        div.style.color = "var(--bright-orange)";
        div.style.border = "1px solid #999";
      } else {
        div.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        div.style.color = "white";
        div.style.border = "0";
      }
    });
  }
}
