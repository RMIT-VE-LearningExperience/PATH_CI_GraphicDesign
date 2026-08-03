# PATH CI GraphicDesign

Minimal Next.js (App Router + TypeScript) app at repository root, configured for Firebase App Hosting. Graphic design PATH tutorials app, forked from PATH-Template.

## Requirements

- Node.js `20.x`
- npm `10+` (recommended)

## Local development

```bash
npm install
npm run dev
```

## Build and run

```bash
npm run build
npm start
```

The app serves a single page that renders **PATH CI GraphicDesign**.

## Shared backend

This app shares the `printer-app-531a8` Firebase project with other PATH apps. Isolation is per-app:

- **Firestore:** its own named database (`FIREBASE_DATABASE_ID` / `FIREBASE_ADMIN_DATABASE_ID` = `path-ci-graphicdesign`), separate from the `(default)` database and other apps' named databases.
- **Storage:** one shared bucket, prefixed per app (`STORAGE_PATH_PREFIX` = `path-ci-graphicdesign`) so each app's uploads live under their own folder.
- **Cloud Functions:** exported function names are prefixed per app (`graphicDesignCleanupOrphanedImages`, `graphicDesignAuditOrphanedImages`) and use a distinct `codebase` in `firebase.json`, so they don't collide with another app's functions deployed to the same project.

## Firebase App Hosting notes

- `apphosting.yaml` must live at the repository root.
- App Hosting framework detection requires `package.json` at the repository root.
- Node version is set using `package.json` `engines.node` (`20.x`).
- Build/start commands are configured in `apphosting.yaml` under `scripts`.
