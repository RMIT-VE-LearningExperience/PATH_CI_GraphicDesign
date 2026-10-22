# GraphicDesign restructure: plan and progress log

Last updated: 2026-10-22. Status: phases 1 to 3 done and pushed to `Staging-GraphicDesign`. Next: phase 4 (tabs).

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
2. [x] Multi-image steps. Steps now hold `imageUrls[]` with a parallel `imageAlts[]` (`""` = decorative, `null` = not yet reviewed). Details:
   - Older single-image documents (`imageUrl` / `imageAlt`) are upgraded when read, and rewritten on the next save.
   - New uploads get unique file names. Apparel's index-based names could overwrite another image's file after a reorder.
   - A kept image keeps its alt text when moved. A new or replaced image starts unreviewed.
   - Alt-text tool: one row per image (key `step:<parent>:<step>:<index>`). Saves match the image by URL.
   - Admin step dialog: add many images, drag to reorder, crop and remove each. The video URL can now be set alongside images (no more image-or-video toggle), as in Apparel.
   - Public: a gallery grid per step, and the viewer has previous/next buttons and arrow keys. Stored alt text is used, with the step title as the fallback.
   - Checks: `tsc`, `next lint` and `next build` pass (build with placeholder Firebase env). Not yet tested against a live database.
3. [x] Sub-steps, ported from Apparel. Details:
   - Backend: steps have `stepType` ("main"/"sub") and `parentStepId`, kept in one flat ordered list. Older steps read as main steps.
   - Backend actions: `reorderMainStep` and `reorderSubStep` replace `setStepOrder`. Deleting a main step soft-deletes its sub-steps, and a main step with sub-steps cannot become a sub-step.
   - Shared helper `lib/step-groups.ts` (`groupSteps`, `stepLabels`) gives numbering "1", "1.1", and so on.
   - Admin: a nested drag-and-drop list, "+ Add Sub-step" under each main step, and a step-type selector with a parent picker in the step dialog.
   - Public: sub-steps are indented under the main step (h3 under h2). The "STEP X OF Y" counter counts main steps only.
   - Alt-text tool lists sub-step images with their numbers.
   - Sub-steps are tied to the step list, so they will work in every tab once tabs exist (phase 4).
   - Bug fixed while testing: public step images had collapsed to zero height, because `p: 0` came after `paddingBottom` in `StepImage`. This bug predates phase 2.
   - Checks: `tsc`, `next lint` and `next build` pass. A browser check with mock data confirmed the labels, headings, counter, image gallery and viewer. An in-memory Firestore test covered add, reorder, convert, cascade delete, alt-text apply and old-document upgrade, and all passed. Not yet tried against the live database.
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
- None blocking. Next action: phase 4 (tabs: `section` field, app-wide tab labels, Overview, Steps, Appendix and the Safety popup).
- For phase 4: sub-steps already work on any step list, so each tab's list can reuse `groupSteps`. Overview and Appendix show sub-steps inside the parent's accordion panel, with no numbers.
- Staging and main share one Firestore database (`path-ci-graphicdesign`). Content edits in staging also show on main. A separate staging database was discussed and not yet decided.
- Before any push: ask first (Staging only).
