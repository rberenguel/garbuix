export { metaP };

class MetaP {
  constructor() {
    this.metaPModal = document.createElement("DIV");
    this.metaPModal.id = "metap-modal";
    this.searchText = "";
    this.oldp = window.print;
  }

  bind(commands) {
    window.print = null;
    document.body.appendChild(this.metaPModal);
    this.commands = commands;
    const isMac =
      /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    document.addEventListener("keydown", (ev) => {
      const cmd = isMac ? ev.metaKey : ev.ctrlKey;
      if (ev.key === "p" && cmd) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        this.metaP();
        return;
      }
      this.handler(ev);
    });
  }

  toggle() {
    if (this.metaPModal.style.display === "block") {
      this.metaPModal.style.display = "none";
    } else {
      this.metaPModal.style.display = "block";
    }
  }

  metaP() {
    this.metaPModal.innerHTML = "";
    this.commands.map((d) => {
      const div = document.createElement("DIV");
      div.innerText = d.title;
      div.classList.add("metap-modal-row");
      div.style.display = "block";
      div.addEventListener("click", () => {
        div.lambda();
        this.toggle();
      });
      div.lambda = d.lambda;
      this.metaPModal.appendChild(div);
    });
    this.toggle();
  }

  handler(ev) {
    if (this.metaPModal.style.display === "block") {
      ev.preventDefault();
      ev.stopPropagation();
      const ps = Array.from(this.metaPModal.querySelectorAll("DIV"));
      if (ev.key === "Backspace") {
        this.searchText = this.searchText.slice(0, -1);
      } else if (ev.key === "Escape") {
        if (this.searchText != "") {
          this.searchText = "";
          // TODO avoid this repetition
          const matches = ps.filter((p) =>
            p.textContent.toLowerCase().includes(this.searchText),
          );
          ps.map((p) => (p.style.display = "none"));
          matches.map((p) => (p.style.display = "block"));
        } else {
          this.metaPModal.style.display = "none";
        }
      } else if (ev.key === "Enter") {
        const vizP = ps.filter((p) => p.style.display === "block");
        if (vizP.length === 0) {
          this.searchText = "";
          this.metaPModal.style.display = "none";
          return;
        }
        vizP[0].lambda();
        this.searchText = "";
        this.metaPModal.style.display = "none";
      } else if (ev.key.length === 1) {
        this.searchText += ev.key;
        const matches = ps.filter((p) =>
          p.textContent.toLowerCase().includes(this.searchText),
        );
        ps.map((p) => (p.style.display = "none"));
        matches.map((p) => (p.style.display = "block"));
      }
    }
  }
}

const metaP = new MetaP();
