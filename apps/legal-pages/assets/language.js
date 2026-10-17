const languageButtons = document.querySelectorAll("[data-language]");
const languageSections = document.querySelectorAll("[data-content-language]");

function setLanguage(language) {
  document.documentElement.lang = language;

  for (const button of languageButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.language === language)
    );
  }

  for (const section of languageSections) {
    section.hidden = section.dataset.contentLanguage !== language;
  }
}

for (const button of languageButtons) {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
}

setLanguage("en");
