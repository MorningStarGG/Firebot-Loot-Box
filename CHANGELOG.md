# Changelog

All notable changes to this project will be documented in this file.

## 1.1.0

### Added

- Added display toggles for the built-in loot box visuals:
  - show or hide the gift box
  - show or hide the reward popup/card shell
  - show or hide the won-item content
- Added expanded popup color controls for background, border, glow, and shine.
- Added expanded gift box color controls for body, lid, border, band, icon, and shine.
- Added draw modes:
  - Random
  - Shuffle Bag
  - Anti-Streak
- Added persistent draw state for shuffle bag and anti-streak tracking.
- Added `exitDurationMs` as an explicit exit fade timing setting.
- Added subtitle support to the last loot box selection variable.
- Added `fulltitle` and `full_title` support to the last loot box selection variable, returning item label and subtitle joined with a space.
- Added manager edit/manual controls for the new display, color, timing, and draw mode settings.

### Changed

- Changed overlay lifetime handling so total overlay length is calculated automatically from build-up time, reward hold time, and exit fade time.
- Changed random selection to use cryptographically-backed randomness for weighted draws.
- Updated the overlay renderer so hidden visual pieces are skipped instead of animated invisibly.
- Updated the main loot box effect editor into lazy-rendered accordion sections.
- Updated list item editing in the main loot box effect so item rows are collapsed by default and multiple rows can be expanded at once.
- Updated default popup and gift box colors to preserve the previous visual appearance while exposing the new individual controls.
- Updated README documentation for draw modes, display toggles, color controls, timing behavior, and loot box variables.

### Fixed

- Fixed manager edit saving for `subtitleColor`.
- Fixed manager manual color updates so they save the selected setting key instead of always writing `fontFamily`.
- Fixed manual setting validation to include `subtitleColor`.
- Fixed manager draw mode UI loading by making draw mode normalization available inside the renderer-side options controller.
- Fixed all-hidden visual mode so the selected item is still returned immediately and effect outputs do not hang.
- Improved ARIA state metadata for the main effect editor accordion and collapsed item rows.
