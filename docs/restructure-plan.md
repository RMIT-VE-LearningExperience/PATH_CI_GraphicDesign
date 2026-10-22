# GraphicDesign restructure: plan and progress log

Last updated: 2026-10-22. Status: phase 1 done (local commit, not pushed).

## Ground rules
- Build on a branch based on `Staging-GraphicDesign`. Never push to `main`. Confirm before any push (see CLAUDE.md on Staging).
- Working branch for this session: `claude/happy-lovelace-08bm59`, now reset onto `origin/Staging-GraphicDesign`. Fast-forward only, so no history was lost.
- Starting fresh: no data migration.
- Every phase covers the backend (data model, API, seed, rules), the admin screens and the public app.
- Backporting to the other PATH apps (especially PATH-Template) comes later. Prefer changes that port cleanly.
- Reference repos (read-only): `PATH_CI_Apparel` (sub-steps, multi-image) and `PATH_CI_Visual_Arts` (toggle style).

## Decisions
1. **Hierarchy:** Printer > Product > Steps. Paper Type is removed completely, from the seed and the code.
   - The Product level is `type2`. A Product belongs to exactly one Printer, and a Product used on two Printers is entered twice, each with its own settings.
   - The Printer Overview therefore always comes from the Product's own Printer.
2. **Multi-image steps:** port Apparel's `imageUrls[]` to steps. The alt-text tool must then handle one alt text per image.
3. **Sub-steps:** port the Apparel model.
   - Steps keep a flat list with `stepType` ("main" or "sub") and `parentStepId`.
   - A shared grouping helper builds the blocks.
   - Port the reorder, delete, and convert rules, plus the "cannot convert" dialog.
   - They apply in every tab. In the Overview and Appendix accordions, a sub-step sits inside its parent's panel with no number.
   - The alt-text tool covers sub-step images.
4. **Tabs on the Steps page** (public and admin):
   - Printer Overview: accordion, no step numbers. Content is written once per Printer.
   - Steps: numbered steps with sub-steps.
   - Appendix: accordion, no step numbers.
   - Quick Safety Reminders: not a tab. It shows as a popup.
   - Tab labels are editable and set once for the whole app.
   - Content is editable per tab.
   - Empty tabs are hidden on the public page.
   - Each tab has its own link (`?tab=appendix` style).
   - Use accessible tab semantics.
   - Visual style borrows the toggle from Visual Arts (a MUI ToggleButtonGroup). Its logic is not reused (it only toggles Step-by-step and Full videos, frontend-only).
5. **Safety popup:** per Product. Shown once per browser session on entering the Steps page. A small "!" icon in the Printer Overview tab reopens it.
6. **Proposed data approach:**
   - Add a `section` field to steps (`overview`, `steps`, `appendix`, `safety`).
   - Overview is stored against the Printer item.
   - The other sections are stored against the Product item.
   - This reuses the existing editor, alt-text tool and API.

## Build order (each is a separate reviewable commit)
1. [x] Hierarchy: Paper Type removed from `scripts/seed-content.js`, with Products as `type2` at level_2. The app code is already level-agnostic (driven by `settings/hierarchy`), so nothing else needed changing. `tsc` and `next lint` pass. Re-run `npm run seed-content` against the target database to apply it. Existing Paper items in Firestore would be orphaned, which is fine because we start fresh.
2. [ ] Multi-image steps (`imageUrls[]`), with per-image alt text in the alt-text tool.
3. [ ] Sub-steps (backend, admin dialog, public display, alt-text coverage).
4. [ ] Tabs: `section` field, app-wide editable labels, admin tab editor, public tabs with links, empty-tab hiding.
5. [ ] Safety popup (once per browser session) plus the "!" icon.
6. [ ] Final checks: lint, build, accessibility check (axe), seed-content check.

## Findings from the review (for context)
- Current app: two page types only (browse levels, then steps). Slugs map one-to-one onto levels. `PublicApp.tsx` (about 1,250 lines) and `AdminDashboard.tsx` (about 1,700 lines) are monolithic.
- Level `enabled` flag exists, and the app already skips disabled levels.
- `type1` means "search and link existing" and `type2` means "create new" when adding items in the admin.
- `seed-content.js` still seeds the template's Printers, Papers and Products.
- Apparel stores steps with `imageUrls[]`, `stepType` and `parentStepId`. Its helper is `lib/step-groups.ts`. Our steps have a single `imageUrl` and `imageAlt`.
- Visual Arts `main` has no tab component on its steps page.

## Open items
- None blocking. Next action: phase 2 (multi-image steps and per-image alt text).
- Before any push: ask first (Staging only).
