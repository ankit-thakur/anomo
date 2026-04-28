Project: ANOMO (MenuAnalysisAppClient) — AI agent instructions

Short summary
- This is an Expo (React Native + Expo Router) mobile client built with TypeScript/TSX. The app uses file-based routing under the `app/` folder and functional React components under `components/`.

What you need to know to be productive
- Start commands: project uses npm + expo. Use `npm install` then `npx expo start` (see `package.json` scripts). The app's runtime entry is `expo-router/entry` (package.json `main`).
- Routing/layout: app-level layout and fonts are set in `app/_layout.tsx`. Routes are file-based; `app/index.tsx` redirects to `/home`.
- UI patterns: Components are plain functional React components (no class components). Styling uses React Native `StyleSheet`. Fonts are loaded via `@expo-google-fonts/inter` (see `_layout.tsx`).
- Data flow: user input flows from `MenuInputComponent` -> backend API (axios POST to an API Gateway endpoint) to trigger menu analysis. Results are displayed via `ResultsSection` which composes `MenuItemCard`.
- Conventions: props are lightly typed (many `any[]` or inline types). Prefer following existing lightweight typings rather than introducing large global types. Keep changes minimal and local.

Key files to reference (examples)
- `package.json` — start scripts and dependencies (Expo, react-native, axios).
- `app/_layout.tsx` — font loading and top-level layout/Slot usage.
- `app/index.tsx` — root redirect to `/home`.
- `components/MenuInputComponent.tsx` — demonstrates: modal/panel UX, validation, axios POST to backend API (apiEndpoint variable), keyboard handling and Animated API. Useful for any input/submit flow.
- `components/ResultsSection.tsx` — TabView usage (`react-native-tab-view`) to split Safe/Unsafe lists. Uses `FlatList` and memoized SceneMap.
- `components/MenuItemCard.tsx` — item rendering and filter logic. Uses helper `components/utils/Utils.tsx::formatDisplayList` to format lists.
- `components/utils/Utils.tsx` — small shared utility functions (example: formatDisplayList).

Project-specific cues for edits
- Keep UI API surface stable: many other files import components directly by relative path. Avoid renaming exported components without updating imports.
- Minimal runtime: the app relies on fonts loaded in `_layout.tsx`. Changing how fonts load may cause startup issues (AppLoading fallback is used).
- Network calls: `MenuInputComponent` posts to a hard-coded API Gateway endpoint. If changing the endpoint, update that file and any documentation. Tests or mocks are not present, so add network mocks if you add unit tests.
- Routing: Add new screens under `app/` to create routes automatically. Use the existing pattern (export default components or Redirects).

Examples to copy when adding features
- New screen: create `app/my-screen.tsx` and return a component or a Redirect. Follow `app/index.tsx` for redirect pattern.
- Formatting lists: use `formatDisplayList(items)` for human-friendly comma/and formatting (used in `MenuItemCard`).
- Results lists: use `FlatList` + `MenuItemCard` as in `ResultsSection` — pass `selectedAllergens` and `selectedDiets` as arrays of strings (lowercase expectations exist in comparisons).

Testing, linting, and validation notes
- There are no test scripts defined. DevDependencies include `jest-expo` and `typescript` but no jest config in repo. If adding tests, prefer small component/unit tests using `jest-expo`.
- TypeScript: files use .tsx and lightweight types. Run the TypeScript compiler after edits (tsc) if you add stricter types.

Safety and security
- Secrets: there are no secrets in this repo, but the `MenuInputComponent` calls an external API Gateway URL. Do not hard-code new secrets. If adding AWS SDK usage, follow existing dependency versions in `package.json`.

Preferred PR style for this repo
- Small, focused changes. Keep UI and data changes separated: e.g., backend endpoint updates in one commit, UI adjustments in another.
- Preserve existing prop shapes; prefer local type aliases vs. global rewrites.

If something's unclear, look here first
- If you need to understand how menus are analyzed or backend behavior, this repo only contains the client. The backend endpoint is called from `components/MenuInputComponent.tsx` (search for `invokeAnalyzeMenu`).
- Use `README.md` for general Expo run instructions. For anything platform-specific (native modules), consult Expo docs since there is no native project config here.

Quick checklist for common tasks
- Run app locally: `npm install` then `npx expo start`.
- Add new route: create `app/<name>.tsx`.
- Add UI component: create in `components/`, export default functional component, style with StyleSheet.
- Update network endpoint: change URL in `components/MenuInputComponent.tsx` and add environment/config mechanism if needed.

End — ask for feedback
If you want this file to include stricter typing rules, test commands, or CI hooks (GitHub Actions), tell me what CI/test setups you prefer and I will add them.
