import { initApp } from './menus.js';

initApp().catch((err) => {
  console.error('PORTAL RUSH failed to start:', err);
  document.body.innerHTML = `<div style="color:#fff;padding:40px;font-family:sans-serif">
    <h1>PORTAL RUSH failed to load</h1><p>${err.message}</p>
    <p>Check that the server is running (npm start) and reload.</p></div>`;
});
