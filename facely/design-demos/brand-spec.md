# Facely Advanced Analysis — brand specification

## Source assets

- Product source of truth: the existing Expo app in `facely/`.
- Brand accent: orange `#F26A13`; pressed/deep orange `#D85609`; soft orange tint `#FFF1E7`.
- Foundation: paper white `#FFFCF7` and surface white `#FFFFFF`; ink black `#050505`; hairline `#E9E6E2`.
- Status semantics: improvement/warning uses restrained warm coral; positive uses deep green; neutral uses graphite.
- Lime `#B4F34D` is retired. Do not introduce it in new UI.
- Existing content imagery: local advanced-analysis metric images. Decorative photography is unnecessary because removing it would not reduce product meaning.

## Product character

Facely should feel direct, intelligent, private, and encouraging. It may be bold, but it must not feel like a game scoring a person’s worth. The analysis is guidance, not a diagnosis or an objective definition of attractiveness. Language describes observations and useful actions, avoiding “ideal face,” “defects,” “bad traits,” and alarmist red states.

## Non-negotiables

- One consistent 0–100 score system.
- Orange is the sole brand accent over white surfaces and black ink; semantic coral appears only where meaning requires it.
- Touch targets are at least 44×44 pt and icon-only controls have accessible labels.
- Safe-area insets govern the header, bottom actions, and modal sheets.
- Reduced-motion users receive opacity-only or immediate state changes.

## Assumptions

- Existing Advanced Analysis tab on iOS/Android, shown at 390×844 logical pixels.
- User completed a face scan and has 18 sub-metrics.
- Primary intent: understand results, identify two controllable priorities, inspect evidence, and move into a routine.
- This direction-stage deliverable does not modify production source.
