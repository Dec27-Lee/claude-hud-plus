import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyContextWindowSizeOverride } from '../dist/plus/context-window-override.js';

test('context window override updates size and recomputes percentage', () => {
  const original = process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE;
  try {
    process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE = '270000';
    const stdin = {
      context_window: {
        context_window_size: 200000,
        current_usage: {
          input_tokens: 40000,
          cache_creation_input_tokens: 3000,
          cache_read_input_tokens: 2000,
        },
      },
    };

    applyContextWindowSizeOverride(stdin);

    assert.equal(stdin.context_window.context_window_size, 270000);
    assert.equal(stdin.context_window.used_percentage, 17);
  } finally {
    if (original === undefined) delete process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE;
    else process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE = original;
  }
});

test('context window override leaves data unchanged when env is absent', () => {
  const original = process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE;
  try {
    delete process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE;
    const stdin = {
      context_window: {
        context_window_size: 200000,
        used_percentage: 23,
        current_usage: { input_tokens: 40000 },
      },
    };

    applyContextWindowSizeOverride(stdin);

    assert.equal(stdin.context_window.context_window_size, 200000);
    assert.equal(stdin.context_window.used_percentage, 23);
  } finally {
    if (original === undefined) delete process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE;
    else process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE = original;
  }
});
