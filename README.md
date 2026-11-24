# SPA101 Flashcards

Spanish ↔ English vocabulary flashcards built from my SPA101 class notes (724 cards).

## How to use

1. Open `index.html` in a browser (double-click it, or host it with GitHub Pages).
2. Read the card and say the answer out loud.
3. Tap the card (or press **Space**) to flip it.
4. **Swipe right** (or **→** / ✓) if you got it right, **swipe left** (or **←** / ✗) if you didn't.

Cards come up in random order, from all units mixed together.

- **Mix / ES → EN / EN → ES** chooses which side you see first.
- 🔊 reads the Spanish word aloud, using your device's built-in voice.
- Progress is saved in your browser. **Reset progress** starts over.

## How it decides what to show

Each card has a level from 0 to 5:

- Getting it **right** moves it up one level.
- Getting it **wrong** drops it to level 0, and it is guaranteed to come back within the next 5–9 cards.
- Lower levels are picked much more often. A missed card is about 4× as likely as a new card, and about 50× as likely as a mastered one (level 4 or higher).
- The last 12 cards you saw are never repeated straight away.

## Editing the words

All the vocab is in `js/vocab.js`, one card per line:

```js
["la silla", "chair"],
["sumir", "to sink / to plunge into", "optional note shown on the back"],
```

## Hosting on GitHub Pages

Repo **Settings → Pages → Deploy from a branch**, then pick the branch and the `/ (root)` folder.
