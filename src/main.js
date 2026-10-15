// Entry point: restores the language, wires the DOM events and loads the IX
// catalog. The only module with side effects at load time.

import { initCatalog, initLang } from './actions.js';
import { bindEvents } from './ui/events.js';

initLang();
bindEvents();
initCatalog();
