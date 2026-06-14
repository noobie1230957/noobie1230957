import { Game } from './Game.js';

function boot() {
  const loading = document.getElementById('loading');
  try {
    const game = window.__game = new Game();
    game.start();
    loading?.classList.add('hidden');
  } catch (err) {
    console.error(err);
    if (loading) loading.textContent = 'Failed to start: ' + err.message;
  }
}

// Wait for WebGL + DOM before booting.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
