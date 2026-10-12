# CultureGraph — Plain HTML / CSS / JavaScript version

A converted, framework-free version of the Next.js CultureGraph app.
No build step, no Node.js, no npm install.

## Run it
- **Easiest:** double-click `index.html` (works from the file system).
- **Better (enables offline cache):** serve the folder, e.g. `python3 -m http.server 8000`
  then open http://localhost:8000

## Structure
- `index.html` — page shell (header, footer, script includes)
- `css/styles.css` — design tokens (maroon / turmeric gold / indigo), light & dark theme
- `js/data.js` — all culture items, districts and English/Tamil messages (generated from `data/` and `messages/`)
- `js/app.js` — hash-based router and all pages (Home, Explore, Category, Item detail,
  Districts, District detail, Map, Favorites, Dashboard, About, Credits)
- `sw.js`, `manifest.webmanifest` — offline support and installable app
- `images/`, `icons/` — placeholder artwork and app icons

## Features kept
- Bilingual English / தமிழ் switch (whole interface and content)
- Dark / light mode
- Search and filters (by keyword and district)
- Interactive map with category and district filters and "Near Me" (uses Leaflet + OpenStreetMap; needs internet)
- Favourites saved in the browser (localStorage, same key as the original app)
- Share button, sources, verification badges

## Not carried over
- Login, sign-up, forgot-password, profile and Google sign-in (they depended on Next-Auth/Firebase)
- Firestore sync of favourites (favourites stay on the device)
- Server-side rendering and the Next.js build; data validation script (`scripts/`)

## Editing data
Edit `js/data.js` directly, or regenerate it from the original JSON files under `data/`.
