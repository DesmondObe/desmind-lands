export const THEME_STORAGE_KEY = "lands-theme";
export type Theme = "light" | "dark";

/** Runs in <head> before first paint, so a returning visitor never sees the wrong theme flash. */
export const themeBootScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");document.documentElement.setAttribute("data-theme",p==="dark"?"dark":"light")}catch(e){}})()`;
