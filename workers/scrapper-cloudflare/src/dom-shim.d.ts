// DOM type shims for Puppeteer evaluate() callbacks (browser context)
// These run in the browser page, not in the Worker runtime — use any for simplicity
declare var document: any;
declare var window: any;
type HTMLElement = any;
type HTMLAnchorElement = any;
type HTMLSelectElement = any;
type HTMLOptionElement = any;
