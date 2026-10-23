# GraphicDesign restructure: plan and progress log

Last updated: 2026-10-22. Status: all six build-order items are done. Everything up to the tab switches is on `Staging-GraphicDesign`; the accordion sub-step boxes, anchors, arrows and the pinned footer are the latest commits.

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
4. [x] Tabs. Details:
   - Data: each step has a `section` ("overview", "steps", "appendix", "safety"; older steps default to "steps"). Overview steps are stored against the **printer** (first-level item). The rest are stored against the **product**. Ordering is per section, and sub-steps must sit in the same section as their parent.
   - Tab names: stored in `settings/appSettings.stepTabs`, shared by the whole app. Defaults are Printer Overview, Steps, Appendix and Quick Safety Reminders. Admins edit them with "Edit tab names" on the product's steps screen. Blank names are dropped and names are capped at 40 characters.
   - Admin: the product's steps screen has four tabs. Each tab keeps its own list, with drag reorder and sub-items. Only the Steps tab is numbered.
   - Public: a tab bar (Printer Overview, Steps, Appendix), each tab shown only if it has content. It follows the WAI-ARIA tab pattern, with arrow, Home and End keys. Each tab has a link (`?tab=appendix`). The product opens on Steps by default. Overview and Appendix show as accordions, with sub-items nested inside the parent's panel and no numbers. The step counter only shows on the Steps tab.
   - Quick Safety Reminders: a pop-up, per product, opened once per browser session (`sessionStorage`). A red "!" button in the Printer Overview tab reopens it. If the product has no overview tab, the "!" shows above the content instead.
   - Alt-text tool: covers all four sections, with the tab name in each row's location.
   - Checks: `tsc`, `next lint` and `next build` pass. The in-memory Firestore test covers sections, per-section ordering, the delete-then-add order collision, same-section parents and tab-name validation. A browser check with mock data covered tab labels, ARIA, URLs, keyboard use, accordions, the pop-up (once per session, reopen button) and the admin screens (the add-item payload goes to the printer for Overview). Not yet tried against the live database.
   - Fixed on the way: after a delete, adding a new step could get the same `order` as an existing one. Adding now renumbers the section.
5. [x] Safety popup (once per browser session) plus the "!" icon. Built together with phase 4.
6. [x] Final checks.
   - Lint, `tsc` and `next build`: pass.
   - Seed: run against the staging database by the user (hierarchy now Printers > Products).
   - Accessibility (axe-core 4.10, tags wcag2a, wcag2aa, wcag21a/aa, wcag22aa and best-practice) on 15 views: public overview (pop-up open, accordions collapsed and expanded), steps (sub-steps, gallery), image viewer, appendix, safety pop-up, admin Steps, Overview and Safety tabs, expanded step, add and edit step dialogs, tab-names dialog, and the alt-text page. 0 violations after one fix (accordion headings are now h2, with sub-items h3, so the heading order is valid).
   - Mobile (375px): no horizontal scroll and no touch targets under 24px on the overview, steps and appendix tabs, and the pop-up.
   - Not covered: a real screen-reader pass and testing against the live database.
7. [x] Follow-up changes after review (committed locally, not yet pushed):
   - Admin: tab names are renamed with one pencil at the far right of the tab row. It puts every tab into edit mode (each tab becomes a text field) and a tick and an X appear beside it. Tick or Enter saves only the names that changed; X, Esc or the pencil again cancels; blank names are blocked. The pencil sits outside the tab list, so the tabs are real tabs again, with arrow-key navigation. The "Edit tab names" pop-up was removed.
   - Editor: Increase and Decrease indent buttons. Plain text indents up to 3 levels (blockquote); a list item nests its list. The browser's invalid nested-list output is repaired. The public page allows blockquote, strips its inline styles and styles it itself.
   - Public: on Printer Overview and Appendix the footer is pinned to the bottom of the window, so it does not jump when an accordion closes. The Steps tab is unchanged.
   - Public: the safety "!" button has no ring and sits at the left edge of the content.
   - Public: the tab bar sits in the sticky strip with the title, and the strip is compact on phones (about 100px of an 800px screen at 375px wide).

8. [x] Further follow-ups (committed locally, not yet pushed):
   - Safety pop-up: a divider between sections; the content scrolls in a keyboard-focusable, named region. When it opens by itself the confirm button ("I have read and understood the <safety tab name>.") stays locked until the visitor scrolls to the end, and Esc and outside clicks are blocked until then. A pop-up that fits without scrolling unlocks at once, and reopening from the "!" button is never locked.
   - Public: Overview and Appendix keep the height of the "STEP X OF Y" line (an invisible placeholder), so the sticky strip is the same size on every tab.
   - Admin and backend: each tab can be switched on or off for the whole app (`settings/appSettings.stepTabsActive`). The switches appear beside each tab name in edit mode and are saved with the tick, together with any renames, in one request that sends only what changed. A switched-off tab is hidden from visitors (and the Safety switch also removes the "!" button) but stays in the admin, dimmed and marked "Hidden", with a note, so it can still be edited. If every tab is off, visitors see "Content unavailable, check with staff".

9. [x] Accordion sub-steps and footer (committed locally, not yet pushed):
   - Public footer: pinned to the bottom of the window on every tab, including Steps (it was floating under short content on phones). The page uses `100dvh` where supported.
   - Accordions (Printer Overview, Appendix): each sub-item is now its own bordered box inside its parent's panel, with its own heading (h3) and chevron, so it can expand and retract separately. Every entry and sub-item has an anchor id such as `appendix-2` or `appendix-2-1`. Defaults: three entries or fewer start open, and three sub-items or fewer under one entry start open.
   - Deep links: `#appendix-2-3` (or `#overview-1`) opens the right tab and the sections around it, scrolls to the section and focuses its heading. Link scrolling keeps the section below the sticky strip using the strip's measured height.
   - Up/down arrows (Previous section / Next section, as in PATH-Apparel) on the Overview and Appendix tabs only. They step through the sections that are visible (a closed entry's sub-items are skipped), do not open what they land on, use `replaceState` for the hash (no history entries), are real links, and are disabled at the ends. They sit in a "Page shortcuts" landmark above the back-to-top button.
   - Steps tab: the same Previous step / Next step arrows. Every step card has an anchor id (`step-2`, `step-2-1`, matching the 2 and 2.1 numbering), a link such as `#step-2-1` opens the Steps tab and scrolls to it, and the card takes focus. The arrows are hidden when a product has only one step. They sit above the back-to-top button without overlapping it on a 375px screen.

10. [x] Bug fix (committed locally, not yet pushed): an entry whose text had been cleared in the editor (a lone `<br>`, an empty paragraph or `&nbsp;`) rendered an empty block with spacing, so one accordion entry's panel was taller than another's. Content with no visible text is no longer rendered, in every tab and in the safety pop-up.

11. [x] Admin sideways scroll (committed locally, not yet pushed): the admin main area could be scrolled sideways, so an accidental swipe pushed the content off centre. Cause: the visually hidden helper elements (hidden page heading, "Actions" column label, some dialog status text) were sized with `width: 1` / `height: 1`, which MUI's `sx` reads as 100%, not 1px, so they stretched past the edge of the area. They now use `1px` (also on the public page's screen-reader-only text). The main area also no longer scrolls sideways on screens 700px wide or more (overflow is clipped and long unbroken words wrap). Below 700px the sidebar leaves too little room for the content, so it stays scrollable there. The admin is still not designed for phones (the sidebar is a fixed 300px wide).

## Findings from the review (for context)
- Current app: two page types only (browse levels, then steps). Slugs map one-to-one onto levels. `PublicApp.tsx` (about 1,250 lines) and `AdminDashboard.tsx` (about 1,700 lines) are monolithic.
- Level `enabled` flag exists, and the app already skips disabled levels.
- `type1` means "search and link existing" and `type2` means "create new" when adding items in the admin.
- `seed-content.js` still seeds the template's Printers, Papers and Products.
- Apparel stores steps with `imageUrls[]`, `stepType` and `parentStepId`. Its helper is `lib/step-groups.ts`. Our steps have a single `imageUrl` and `imageAlt`.
- Visual Arts `main` has no tab component on its steps page.

## Open items
- **Old Paper data:** old Paper items live under `items/level_2`, which is now the **Products** level, so they can appear as Products. The user chose not to use a cleanup script and will deal with it themselves (the script was written, tested and then dropped).
- Decided with the user: a product opens on **Printer Overview** the first time it is opened in a browser session (when it has an overview), and on Steps after that. A `?tab=` link always wins. Tracked per product in `sessionStorage`, like the safety pop-up.
- Decided with the user: accordions start fully open when a list has three entries or fewer, and collapsed when it has more. The "!" button stays inside the Printer Overview tab.
- Staging and main share one Firestore database (`path-ci-graphicdesign`). Content edits in staging also show on main. A separate staging database was discussed and not yet decided.
- Backporting to the other PATH apps (especially PATH-Template) is parked for later.
- Before any push: ask first (Staging only).
