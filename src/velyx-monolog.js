import monologCss from "./velyx-monolog.css?inline";

const STYLE_ID = "velyx-monolog-runtime-style";

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = monologCss;
  document.head.append(style);
}
