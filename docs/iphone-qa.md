# iPhone QA checklist

Run on a real iPhone against the deployed site after any change to the logging path, the scanner, layout or the PWA setup. Unit and e2e tests can't cover these.

## Behaviour

- [ ] Installs to the home screen; launches standalone; safe areas are correct and the tab bar clears the home indicator.
- [ ] `＋` raises the keyboard immediately. No zoom on focus.
- [ ] The Add bar rides on the decimal keypad. A comma decimal is accepted.
- [ ] The back swipe closes the Add overlay rather than leaving the app.
- [ ] The scanner reads a UPC-A and an EAN-13 in Safari and standalone (Diary Add screen and the food form's Barcode field), and stops the camera when closed or backgrounded.
- [ ] Offline (airplane mode): Diary, Recents, local search and logging all work. Remote search shows the offline note.
- [ ] Light and dark themes follow the system setting.
- [ ] The day rolls over when the app is reopened after midnight.
- [ ] Long-press "Copy to today" on a past day works, and drag-to-reorder works by touch (meal items, categories).

## Performance budgets (SPEC §9)

Measure on an iPhone 12-class device, production build, installed:

| Interaction | Budget |
|---|---|
| Cold start (cached PWA) to interactive Diary | < 1.5 s |
| Tap `＋` to keyboard visible with the input focused | < 150 ms |
| Keystroke to updated local results | < 50 ms p95 |
| Tap Add to entry visible in the totals | < 100 ms |
| Repeat remote query (cached) to results shown | < 50 ms |
| Tap scan to live camera (after permission) | < 1 s |

Lighthouse (mobile): Performance ≥ 90, Accessibility ≥ 95, installable PWA.
