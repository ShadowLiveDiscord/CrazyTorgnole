const { ipcRenderer } = require("electron");

export default class popup {
    constructor() {
        /** @type {HTMLElement} */
        this.popup = document.querySelector(".popup");
        /** @type {HTMLElement} */
        this.popupTitle = document.querySelector(".popup-title");
        /** @type {HTMLElement} */
        this.popupContent = document.querySelector(".popup-content");
        /** @type {HTMLElement} */
        this.popupOptions = document.querySelector(".popup-options");
        /** @type {HTMLElement} */
        this.popupButton = document.querySelector(".popup-button");
    }

    openPopup(info) {
        this.popup.style.display = "flex";
        if (info.background === false) {
            this.popup.style.background = "none";
        } else {
            this.popup.style.background = "#000000bb";
        }
        this.popupTitle.innerHTML = info.title;
        this.popupContent.style.color = info.color ? info.color : "#121212";
        this.popupContent.innerHTML = info.content;

        if (info.options) {
            this.popupOptions.style.display = "flex";
        }

        if (this.popupOptions.style.display !== "none") {
            this.popupButton.addEventListener("click", () => {
                if (info.exit) return ipcRenderer.send("main-window-close");
                this.closePopup();
            });
        }
    }

    closePopup() {
        this.popup.style.display = "none";
        this.popupTitle.innerHTML = "";
        this.popupContent.innerHTML = "";
        this.popupOptions.style.display = "none";
    }
}