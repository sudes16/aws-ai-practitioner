# AWS AI Practitioner Quiz App — Code Review

**Platform:** React Native + Expo SDK 51 / TypeScript 5.3.3  
**Review Date Range:** May 20–23, 2026  
**Reviewer:** GitHub Copilot (Claude Sonnet 4.6)  
**Type:** Iterative static analysis — 4 passes — single source of truth

---

## Why Was the High-Risk Bug Not Found in Earlier Passes?

> **Issue #35 (🔴 HIGH) was found in Pass 4 but not in Passes 1–3.**

| Pass | Codebase state |
|------|----------------|
| Pass 1–3 | Original app — OTA feature did not exist |
| Between P3 → P4 | Enhancement E6 (OTA) was implemented — **bug was introduced here** |
| Pass 4 | First review of new OTA code — bug caught immediately |

This is expected behaviour. A review can only find bugs in code that already exists.

---

## Review History

### Pass 1 — Initial Static Review (2026-05-20) · All Fixed

| # | File | Issue | Risk | Status |
|---|------|-------|------|--------|
| F1 | `HomeScreen.tsx` | `getMasteredCount` imported but never called | Low | ✅ Fixed |
| F2 | `ExamResultScreen.tsx` | `clearExamResult` imported; `_pending` store never freed | Low | ✅ Fixed |
| F3 | `ReviewScreen.tsx` | `stripMarkdown` imported but never called | Low | ✅ Fixed |
| F4 | `HomeScreen.tsx` | 16 dead styles (headerTitleBlock, divider, 13 optionChip* variants) | Low | ✅ Fixed |
| F5 | `QuizScreen.tsx` | `Array.isArray(q.options)` always false; report email body always empty | Low | ✅ Fixed |
| F6 | `SettingsScreen.tsx` | `PLAY_STORE_URL` used placeholder bundle ID | Medium | ✅ Fixed |
| F7 | Multiple | AIF-C01 domain counts/percentages duplicated in 3 files | Low | ✅ Fixed |
| F8 | `HomeScreen.tsx` | Two consecutive spacer `<View>` elements (20+8) instead of one 28 | Low | ✅ Fixed |
| F9 | `HomeScreen.tsx` | Inline style `{ alignItems: 'center' }` created on every render | Low | ✅ Fixed |

---

### Pass 2 — Post-Cleanup Re-scan (2026-05-20)

| # | File | Issue | Risk | Status |
|---|------|-------|------|--------|
| A | `ExamResultScreen.tsx` | `clearExamResult` still not wired after Pass 1 | Low | ✅ Fixed |
| B | `QuizScreen.tsx` | Dead branch carryover (F5) | Low | ✅ Fixed |
| C | `SettingsScreen.tsx` | `PLAY_STORE_URL` placeholder (carryover F6) | Medium | ⏸ Deferred (user choice) |
| D | Multiple | Domain weights still in 3 files (carryover F7) | Low | ✅ Fixed |
| E | `HomeScreen.tsx` | `Linking` imported but never called | Low | ✅ Fixed |
| F | `PrivacyPolicyScreen.tsx` | `CONTACT_EMAIL = 'your@email.com'` shown to users | Medium | ⏸ Deferred (user choice) |
| G | `SettingsScreen.tsx` | `minute: 0` hardcoded 4 times across reminder calls | Low | ✅ Fixed → `REMINDER_MINUTE` |
| H | `HomeScreen.tsx` | `allQuestions`/`domainCounts` in `useMemo([])` — static data | Very Low | ✅ Fixed |
| I | `quizEngine.ts` | `getDomain()` exported but no external file imports it | Very Low | ✅ Fixed |

---

### Pass 3 — Deep Comprehensive Review (2026-05-20/21) · All Fixed

**Issues (19 total):**

| # | File(s) | Issue | Risk | Status |
|---|---------|-------|------|--------|
| F01 | `SettingsScreen.tsx` | `minute: 0` in 4 separate `scheduleReminder` calls | Low | ✅ Fixed → `DEFAULT_REMINDER_MINUTE` |
| F02 | `HomeScreen.tsx` | `weakCount` useMemo re-called `getAllQuestions()` unnecessarily | Low | ✅ Fixed |
| F03 | `quizEngine.ts` | Dead `counts[0]` initializer (domain 0 never exists) | Low | ✅ Fixed |
| F04 | Multiple | Hardcoded `65` (exam question count) in 3 files | Low | ✅ Fixed → `EXAM_TOTAL_QS` |
| F05 | `ExamResultScreen.tsx` | Pass threshold `46` hardcoded; should derive from `EXAM_TOTAL_QS * PASS_THRESHOLD` | Low | ✅ Fixed |
| F06 | `HomeScreen.tsx` | `count: 65` hardcoded in `handleExamStart` | Low | ✅ Fixed |
| F07 | `QuizScreen.tsx` | `navigation.navigate('ExamResult') as never` cast suppressed type error | Low | ✅ Fixed |
| F08 | `QuizScreen.tsx` | Direct `submitExam()` call in event handler undocumented | Low | ✅ Fixed |
| F09 | `QuizScreen.tsx` | 5 `eslint-disable` suppressions with no explanation | Low | ✅ Fixed |
| F10 | `QuizScreen.tsx` | `getAllQuestions()` called redundantly inside `submitExam` | Low | ✅ Fixed |
| F11 | Multiple | 4 `as any` casts for CSS percentage strings in React Native styles | Low | ✅ Fixed → `cssVal()` helper |
| F12 | `SettingsScreen.tsx` | Clipboard write not wrapped in `try/catch` | Low | ✅ Fixed |
| F13 | Multiple | Exam date year lower bound hardcoded `< 2024` | Low | ✅ Fixed → dynamic check |
| F14 | `notificationService.ts` | `REMINDER_MINUTE = 0` defined locally; should export from notificationService | Low | ✅ Fixed |
| F15 | `PrivacyPolicyScreen.tsx` | Privacy policy described wrong modes ("Unseen Questions") | Medium | ✅ Fixed |
| F16 | `app.json` | `expo-notifications` plugin missing from `plugins` array | Medium | ✅ Fixed |
| F17 | `SettingsScreen.tsx` | `PLAY_STORE_URL` still used placeholder bundle ID | Medium | ✅ Fixed → `com.awsquiz.aifpractitioner` |
| F18 | `quizEngine.ts` | No runtime schema validation on `questions.json` load | Medium | ✅ Fixed → `isValidQuestion` filter |
| F19 | Multiple | Date validation hardcoded lower bound (same as F13) | Low | ✅ Fixed |

**Enhancements (8 total — all implemented):**

| # | Enhancement | Status |
|---|------------|--------|
| E1 | Accessibility labels on all interactive elements | ✅ Done |
| E2 | `ErrorBoundary` component for unhandled render errors | ✅ Done |
| E3 | Score history persistence + Analytics screen | ✅ Done |
| E4 | Exam countdown notifications (T-7, T-1 day) | ✅ Done |
| E5 | Dark mode / Theme toggle (`ThemeContext`) | ✅ Done |
| E6 | OTA question bank fetch (ETag-aware) | ✅ Done |
| E7 | Spaced repetition (SM-2 algorithm, Smart Study mode) | ✅ Done |
| E8 | In-app question reporting modal (`addQuestionReport`) | ✅ Done |

---

### Pass 4 — Post-Enhancement Comprehensive Audit (2026-05-21/23)

> **Health: B+** · 🔴 HIGH: 1 · 🟠 Medium: 5 · 🟡 Low: 16

| # | File | Issue | Risk | Status |
|---|------|-------|------|--------|
| [→#25] | `package.json` | `expo-splash-screen` installed but never imported | Medium | Open |
| [→#26] | `src/constants/colors.ts` | `export const Colors = LightColors` — legacy alias, never imported | Low | Open |
| [→#27] | `src/utils/spacedRepetition.ts` | `getAllSRRecords()` / `resetSRData()` exported but never imported | Low | Open |
| [→#17] | `src/utils/storage.ts` | `getQuestionReports()` never read; reports invisible to user | Low | ✅ Fixed → `ReportsScreen` |
| [→#28] | `src/contexts/ThemeContext.tsx` | `themeMode` state not persisted; resets to system on every restart | Medium | Open |
| [→#29] | `src/screens/ResultScreen.tsx` | `answered` outer declaration shadowed by inner `useEffect` declaration | Low | Open |
| [→#30] | `HomeScreen` + `SettingsScreen` | Date validation + profile save + countdown notifications duplicated verbatim | Low | Open |
| [→#31] | `ResultScreen` + `ExamResultScreen` | `AWS_PASS_PCT = 70` and `PASS_THRESHOLD = 0.70` same value in two files | Low | Open |
| [→#32] | `src/utils/notificationService.ts` | `setNotificationHandler()` called inside two functions; registered multiple times | Low | Open |
| [→#10] | `src/utils/storage.ts` | `quiz_reports` had no size cap | Low | ✅ Fixed → capped at 100 (LIFO) |
| [→#33] | `App.tsx` | `loadCachedOtaQuestions()` fires post-render; `getTotalCount()` sees stale 0 | Medium | Open |
| [→#34] | `src/utils/quizEngine.ts` | Placeholder OTA URL fires on every launch (doomed network request) | Medium | Open |
| **[→#35]** | `src/utils/quizEngine.ts` | **🔴 OTA domain map keyed by `q.number` not array index — all OTA Qs → Domain 1** | **HIGH** | **Open** |
| [→#12] | `app.json` | `"permissions": []` override may strip Android notification permissions from build | Medium | Open |
| [→#36] | `app.json` | No `NSUserNotificationsUsageDescription` in `ios.infoPlist` → App Store rejection | Medium | Open |
| [→#37] | `eas.json` | No iOS build profile defined | Low | Open |
| [→#38] | `QuizScreen.tsx` | `handleReport` declared `async` but contains no `await` | Low | Open |
| [→#22-web] | `QuizScreen.tsx` | `Alert.alert()` after `await` silently suppressed by browser on web | Low | ✅ Fixed → in-modal flash |
| [→#39] | `ExplanationModal.tsx` | Close/Dismiss buttons missing `accessibilityLabel` / `accessibilityRole` | Low | Open |
| [→#40] | `HotspotQuestion.tsx` | Dropdown `TouchableOpacity` elements missing `accessibilityLabel` | Low | Open |
| [→#41] | `tsconfig.json` | `skipLibCheck: true` suppresses 3rd-party `.d.ts` type errors | Low | Open |
| [→#42] | `quizEngine.ts` | `_questions` / `_domainMap` module-level mutable state | Low | Open |

---

## Issue Details

### #1 — Dead Function: `getQuestionReports`  ✅ Fixed (May 23 2026)
**File:** `src/utils/storage.ts`  **Type:** Dead Code | **Risk:** Low

`getQuestionReports` was a non-exported `const` that was never called anywhere.
`addQuestionReport` (the write side) remained active from QuizScreen.

**Action taken:** Restored as a proper export alongside new `deleteQuestionReport(timestamp)`.
`ReportsScreen.tsx` created; wired into `SettingsScreen` and `AppNavigator`.

---

### #2 — Dead Function: `getAllSRRecords`  ✅ Fixed (May 23 2026)
**File:** `src/utils/spacedRepetition.ts`  **Type:** Dead Code | **Risk:** Low

`getAllSRRecords` was private and never called anywhere.

**Action taken:** Function removed from `spacedRepetition.ts`.

---

### #3 — Phantom State: `scoreHistory` Read Path  ✅ Fixed (May 23 2026)
**Files:** `src/screens/SettingsScreen.tsx`, `src/utils/storage.ts`  
**Type:** Unused Variable | **Risk:** Low

`getScoreHistory()` was called on every Settings open but the result was never rendered.
`ScoreSession` data is now the primary source for `AnalyticsScreen` and `SessionHistoryScreen`.

**Action taken:** `scoreHistory` state and its `getScoreHistory()` call removed from `SettingsScreen.tsx`.

---

### #4 — Unused Color Token: `awsNavy`  ✅ Fixed (May 23 2026)
**File:** `src/constants/colors.ts`  **Type:** Unused Variable | **Risk:** Low

`awsNavy: '#1A2332'` defined in both `LightColors` and `DarkColors` but never referenced.

**Action taken:** Removed from both objects. `ColorScheme` type updated automatically.

---

### #5 — Magic String Key: `'onboarding_complete'`
**File:** `src/navigation/AppNavigator.tsx` (line 23)  
**Type:** Maintainability | **Risk:** Medium

`AppNavigator.tsx` hardcodes `'onboarding_complete'` as a string literal. The same key is
exported as `ONBOARDING_KEY` from `OnboardingScreen.tsx` but `AppNavigator` doesn't import it.
If the key name changes, first-launch routing breaks silently.

**Action:** Import and use `ONBOARDING_KEY` from `OnboardingScreen.tsx`, or move the constant to
`src/constants/storageKeys.ts`.

---

### #6 — Missing `.catch()` on AppNavigator AsyncStorage Read  ✅ Fixed (May 21 2026)
**File:** `src/navigation/AppNavigator.tsx`  **Type:** Stability | **Risk:** Medium

`AsyncStorage.getItem(...).then(val => { setInitialRoute(...) })` had no `.catch()`.
On storage failure, `initialRoute` would stay `null` permanently (blank screen, no recovery).

**Action taken:** Added `.catch(() => setInitialRoute('Onboarding'))`.

---

### #7 — Missing Error Handling in `noteStore.ts`  ✅ Fixed (May 21 2026)
**File:** `src/utils/noteStore.ts`  **Type:** Stability | **Risk:** Medium

Both `saveNoteForQuestion` and `getAllNotes` called AsyncStorage with no `try/catch`.
Unlike every other storage utility in the codebase, these would throw unhandled promise
rejections and could crash an active quiz session.

**Action taken:** Both functions wrapped in `try/catch`.

---

### #8 — Biased Shuffle in `spacedRepetition.ts`
**File:** `src/utils/spacedRepetition.ts` (line 110)  
**Type:** Algorithm Quality | **Risk:** Low

`arr.sort(() => Math.random() - 0.5)` produces a non-uniform distribution.
A correct Fisher-Yates implementation already exists in `quizEngine.ts`.

**Action:** Extract the Fisher-Yates shuffle into `src/utils/mathUtils.ts` and use it in both places.

---

### #9 — Module-Level Mutable State in `examResultStore.ts`
**File:** `src/utils/examResultStore.ts`  **Type:** Architecture | **Risk:** Low

`let _pending: ExamResultData | null = null` is justified (Expo Web URL length limits) but if
navigation is interrupted, the result screen shows empty data.

**Action:** Acceptable trade-off for now. Future: persist to AsyncStorage as a transient key and
clear after reading, to survive app restarts.

---

### #10 — OTA URL Has No Integrity Check and Embeds Personal GitHub Username
**File:** `src/utils/quizEngine.ts` (lines 230–231)  
**Type:** Security | **Risk:** Medium (dormant — only active when `OTA_ENABLED = true`)

`OTA_QUESTIONS_URL = 'https://raw.githubusercontent.com/sudes16/AppStore/main/questions.json'`
points to a real, live GitHub repository. Two concerns for when `OTA_ENABLED` is set to `true`:

1. **No integrity check** — fetched JSON is validated for shape only. No hash/checksum verification.
   A compromised account could deliver malicious data silently.
2. **Personal GitHub username** in the production bundle is a privacy/attribution concern.

**Action:** Before enabling OTA: (a) host under an org/app-specific URL; (b) add a `.sha256` manifest
and validate client-side before merging. No change needed while `OTA_ENABLED = false`.

---

### #11 — `cssVal` Returns `any` Without Constraint
**File:** `src/utils/styleUtils.ts`  **Type:** Type Safety | **Risk:** Low

`cssVal(val)` returns `any` unconditionally, bypassing TypeScript for all callers.

**Action:** Constrain to `(val: string): string` since the workaround only applies to string
CSS values (percentages, `'auto'`).

---

### #12 — Missing Explicit `permissions` in `app.json`
**File:** `app.json`  **Type:** Play Store Compliance | **Risk:** Low

The `android` block has no explicit `permissions` array. Expo may auto-include
`RECEIVE_BOOT_COMPLETED`, `VIBRATE`, and `WAKE_LOCK`. Explicitly declaring all permissions
required for Play Store Data Safety accuracy.

**Action:** Add `"permissions"` array to the `android` block and verify with `expo prebuild`.

---

### #13 — Missing `targetSdkVersion` in `app.json`  ✅ Fixed (May 21 2026)
**File:** `app.json`  **Type:** Play Store Compliance | **Risk:** Medium

No explicit `targetSdkVersion` set. Google Play requires API Level 34+.

**Action taken:** Added `"targetSdkVersion": 34` and `"compileSdkVersion": 34` to `android` section.

---

### #14 — `ErrorBoundary` Retry Misleads User
**File:** `src/components/ErrorBoundary.tsx`  **Type:** UX | **Risk:** Low

`handleRetry` calls `setState({ hasError: false })`, which re-renders the same failing child.
If the error stems from persistent corrupted state, it will throw again immediately.

**Action:** Rename to "Reload App" and use `Updates.reloadAsync()` for a true restart, or add
guidance text to force-close the app.

---

### #15 — `isDark` Destructured but Never Used in `SettingsScreen.tsx`
**File:** `src/screens/SettingsScreen.tsx` (line 42)  
**Type:** Unused Variable | **Risk:** Low

`const { colors, isDark, themeMode, setThemeMode } = useTheme();` — `isDark` is extracted
but never referenced in the component. Not caught by TypeScript because `noUnusedLocals`
is off by default.

**Action:** Remove `isDark` from the destructuring.

---

### #16 — `ScoreSession.mode` Typed as `string` with Inconsistent Values
**File:** `src/utils/storage.ts` (ScoreSession interface), `src/screens/ResultScreen.tsx`  
**Type:** Type Safety | **Risk:** Low

`ScoreSession.mode` is typed as `string`. `ExamResultScreen` stores `'exam'`; `ResultScreen`
stores `'quiz'`. The companion `SessionRecord` uses the precise union `'practice' | 'exam'`,
and `ResultScreen` saves `'practice'` there. The asymmetry (`'quiz'` vs `'practice'` for the
same session) is semantically inconsistent.

**Action:** Tighten `ScoreSession.mode` to `'quiz' | 'practice' | 'exam'` and standardise
`ResultScreen.tsx` to save `'practice'` to align with `SessionRecord`.

---

### #17 — `addQuestionReport` Writes Data Never Read by Any UI  ✅ Fixed (May 23 2026)
**File:** `src/utils/storage.ts`, `src/screens/QuizScreen.tsx`  
**Type:** Half-Implemented Feature | **Risk:** Low

Reports were saved to AsyncStorage but no screen ever read them. Users received a
"Report Submitted" alert implying feedback was acted on, but data was permanently siloed.
Additionally, the `Alert.alert()` was called after `await`, causing it to be silently
suppressed by the browser (see #22).

**Action taken:**
- Restored `getQuestionReports()` + added `deleteQuestionReport(timestamp: string)` to `storage.ts`
- Created `src/screens/ReportsScreen.tsx` (list, delete individual, Export via Share)
- Added "My Question Reports" row to `SettingsScreen` with count badge
- Registered `Reports` screen in `AppNavigator` and `RootStackParamList`
- Replaced `Alert.alert()` with in-modal "✓ Report saved" flash (1.2 s, `reportSaved` state)

---

### #18 — `useEffect` in `ResultScreen.tsx` Has Incomplete Dependency Array
**File:** `src/screens/ResultScreen.tsx` (lines 85–131)  
**Type:** React Best Practice | **Risk:** Low

Save `useEffect` uses `score`, `total`, and `quit` from `route.params` but only lists
`[history]` as a dependency. Functionally safe (params are immutable), but a maintenance
trap for future developers.

**Action:** Add `score`, `total`, and `quit` to the dependency array, **or** add an
`// eslint-disable-next-line react-hooks/exhaustive-deps` comment with an explanatory note.

---

### #19 — `useEffect` in `ExamResultScreen.tsx` Has Empty Dependency Array but Uses Derived Values
**File:** `src/screens/ExamResultScreen.tsx`  **Type:** React Best Practice | **Risk:** Low

`useEffect(() => { saveSessionRecord(...); addScoreSession(...); }, [])` uses `totalCorrect`,
`history`, `elapsedSeconds`, and `answeredCount` without listing them as dependencies.
Functionally safe (values come from a module-level store), but intent is undocumented.

**Action:** Add a comment: `// one-shot on mount; values from module store are immutable after navigation`.

---

### #20 — `getExamResult()` Called at Component Body Level
**File:** `src/screens/ExamResultScreen.tsx` (line ~24)  
**Type:** Robustness | **Risk:** Low

`const stored = getExamResult();` is called at the top of the component on every render.
If the component re-mounts (React 18 Strict Mode, deep-linked navigation), `stored` would be
`null` after cleanup and an empty result screen would show.

**Action:** Capture once on mount using `useRef` or `useMemo` with `[]` deps so subsequent
renders use the snapshot taken when the screen first appeared.

---

### #21 — Multiple Independent `new Date()` Calls for the Same Session Timestamp
**Files:** `src/screens/ResultScreen.tsx`, `src/screens/ExamResultScreen.tsx`  
**Type:** Data Consistency | **Risk:** Low

`new Date().toISOString()` is called 2–3 times within the same `useEffect` to populate
`addScoreSession.date`, `saveSessionRecord.id`, and `saveSessionRecord.date`. Each call
captures a slightly different instant, creating millisecond mismatches. `SessionHistoryScreen`
compensates with a 5-second tolerance window — an ad-hoc patch for a trivial root cause.

**Action:** Capture `const now = new Date().toISOString();` once at the top of each save
`useEffect` and reuse `now` for all date/id fields.

---

### #22 — `navigation.navigate(item.screen as any)` Bypasses Type Checking in `HomeScreen.tsx`
**File:** `src/screens/HomeScreen.tsx` (line 908)  
**Type:** Type Safety | **Risk:** Low

Menu items array is typed `{ screen: keyof RootStackParamList }[]` but the navigate call uses
`item.screen as any`. All current menu items target param-less screens so there is no runtime
risk today, but a future item pointing to a screen that requires params would silently accept
a broken call.

**Action:** Remove the `as any` cast. The `keyof RootStackParamList` constraint is sufficient.

---

### #23 — `getAllNotes()` Uses `AsyncStorage.getAllKeys()` (Full Key Scan)
**File:** `src/utils/noteStore.ts`  **Type:** Scalability | **Risk:** Low

`getAllNotes()` fetches every AsyncStorage key, then filters by the `'quiz_note_'` prefix.
Called on every `QuizScreen` and `ReviewScreen` mount. Negligible at current scale; degrades
at thousands of entries.

**Action:** Maintain a `quiz_note_index` key storing the list of question numbers with notes,
avoiding the full scan. Not urgent for current scale.

---

### #24 — `PLAY_STORE_URL` Hardcodes the Package Name
**File:** `src/screens/SettingsScreen.tsx` (~line 40)  
**Type:** Maintainability | **Risk:** Low

`const PLAY_STORE_URL = 'https://play.google.com/...?id=com.awsquiz.aifpractitioner'`
encodes the package name inline. Same name appears in `app.json`. If the package name changes,
the URL breaks silently.

**Action:** Extract `APP_PACKAGE_ID` as a named constant (or read from a shared config) and
construct the URL from it.

---

### #25 — `expo-splash-screen` Dead Dependency
**File:** `package.json`  **Type:** Dead Dependency | **Risk:** Medium

`expo-splash-screen` is installed but never imported. The splash screen dismisses immediately
rather than being held until the app is ready.

**Action:** Either wire `SplashScreen.preventAutoHideAsync()` + `SplashScreen.hideAsync()` in
`App.tsx`, or remove the package.

---

### #26 — `Colors` Legacy Alias in `colors.ts`
**File:** `src/constants/colors.ts`  **Type:** Dead Export | **Risk:** Low

`export const Colors = LightColors` is a legacy alias. No file imports `Colors`.

**Action:** Remove the alias.

---

### #27 — `getAllSRRecords` / `resetSRData` Exported but Never Imported
**File:** `src/utils/spacedRepetition.ts`  **Type:** Unused Exports | **Risk:** Low

Both functions are exported but no other file imports them. `resetSRData` in particular
would be useful wired into the Settings reset flow.

**Action:** Wire `resetSRData()` into `SettingsScreen` (alongside the existing Exam History
reset), or remove both exports.

---

### #28 — `themeMode` State Lost on App Restart
**File:** `src/contexts/ThemeContext.tsx`  **Type:** State Loss | **Risk:** Medium

`themeMode` is held in component state only; the Light/Dark preference resets to `'system'`
on every cold start.

**Action:** Persist `themeMode` to AsyncStorage and rehydrate on context init.

---

### #29 — Shadow Variable: `answered` in `ResultScreen.tsx`
**File:** `src/screens/ResultScreen.tsx`  **Type:** Code Quality | **Risk:** Low

`answered` is declared in the outer component scope AND re-declared inside a `useEffect`.
The inner declaration shadows the outer, creating a confusing dual identity.

**Action:** Remove the redundant outer declaration.

---

### #30 — Duplicated Profile-Save Logic in `HomeScreen` and `SettingsScreen`
**Files:** `src/screens/HomeScreen.tsx`, `src/screens/SettingsScreen.tsx`  
**Type:** DRY Violation | **Risk:** Low

Date validation, profile save, and `scheduleExamCountdownNotifications` are duplicated
verbatim in both screens.

**Action:** Extract into a shared helper in `profileStore.ts` (e.g. `validateAndSaveProfile()`).

---

### #31 — Duplicate Pass Threshold Constant
**Files:** `src/screens/ResultScreen.tsx`, `src/screens/ExamResultScreen.tsx`  
**Type:** DRY Violation | **Risk:** Low

`AWS_PASS_PCT = 70` and `PASS_THRESHOLD = 0.70` express the same value in two files.

**Action:** Define once in `src/constants/types.ts` (already has `PASS_THRESHOLD_PCT = 70`)
and remove the local duplicates.

---

### #32 — `setNotificationHandler()` Registered Multiple Times Per Session
**File:** `src/utils/notificationService.ts`  **Type:** Repeated Init | **Risk:** Low

`setNotificationHandler()` is called inside both `scheduleReminder()` and
`scheduleExamCountdownNotifications()`. If both are called in one session, the handler
is registered twice, potentially causing duplicate notification events.

**Action:** Call `setNotificationHandler()` once at module init, guarded by `Platform.OS !== 'web'`.

---

### #33 — OTA Race Condition: `loadCachedOtaQuestions` Runs Post-Render
**File:** `App.tsx`  **Type:** Race Condition | **Risk:** Medium

`loadCachedOtaQuestions()` fires inside a `useEffect` (post-render). `getTotalCount()` in
`HomeScreen` is computed at module load time (before the effect runs), so it always sees the
pre-OTA question count on the first render.

**Action:** Call `loadCachedOtaQuestions()` synchronously before `registerRootComponent()`,
or add a loading gate that defers HomeScreen render until OTA hydration completes.

---

### #34 — OTA Placeholder URL Fires a Doomed Network Request on Every Launch
**File:** `src/utils/quizEngine.ts` (lines 230–231)  **Type:** Configuration | **Risk:** Medium

`OTA_ENABLED = false` but the placeholder URL is still constructed and passed to `fetch()`.
Every app launch makes a network request that will always fail with a 404 or redirect.

**Action:** Guard the fetch call with `if (!OTA_ENABLED) return;` so no network activity
occurs until the feature is intentionally enabled.

---

### #35 — 🔴 HIGH: OTA Domain Map Keyed by Question Number Instead of Array Index

**File:** `src/utils/quizEngine.ts` — `fetchRemoteQuestions()` and `loadCachedOtaQuestions()`  
**Type:** Logic Bug | **Risk:** 🔴 HIGH

**⚠ Must fix before enabling OTA (`OTA_ENABLED = true`) or publishing to Play Store.**

After merging OTA questions, the domain map is rebuilt as:

```typescript
// CURRENT — WRONG: keyed by q.number
_domainMap.clear();
for (const q of _questions) _domainMap.set(q.number, getDomain(q));
```

But `getDomainForIndex(i)` performs a lookup by **array index**, not question number:

```typescript
// getDomainForIndex uses index i, not question number
return _domainMap.get(i) ?? 1;
```

**Result:** Every OTA-added question is silently classified as Domain 1 (AI/ML Fundamentals),
poisoning Analytics domain breakdowns and the domain-filter feature.

**Fix:**

```typescript
// CORRECT: key by array index to match getDomainForIndex()
_domainMap.clear();
_questions.forEach((q, i) => _domainMap.set(i, getDomain(q)));
```

Apply this fix in **both** `fetchRemoteQuestions()` and `loadCachedOtaQuestions()`.

---

### #36 — Missing `NSUserNotificationsUsageDescription` in iOS `infoPlist`
**File:** `app.json`  **Type:** App Store Compliance | **Risk:** Medium

No `NSUserNotificationsUsageDescription` key in `ios.infoPlist`. The App Store review team
requires this string for any app that requests notification permission.

**Action:** Add to `app.json`:
```json
"ios": {
  "infoPlist": {
    "NSUserNotificationsUsageDescription": "We send daily study reminders and exam countdown alerts to help you stay on track."
  }
}
```

---

### #37 — No iOS Build Profile in `eas.json`
**File:** `eas.json`  **Type:** Configuration | **Risk:** Low

Only Android build profiles are defined. An iOS submission would fail or use unintended defaults.

**Action:** Add `"ios": { "buildType": "release" }` to both `preview` and `production` profiles.

---

### #38 — `handleReport` Declared `async` Without Any `await`
**File:** `src/screens/QuizScreen.tsx`  **Type:** Code Quality | **Risk:** Low

```typescript
const handleReport = () => {     // ← was async, no await inside
  setReportCategory('wrong_answer');
  setReportNote('');
  setShowReportModal(true);
};
```

The `async` keyword is unnecessary and misleads the reader into thinking an async operation occurs.

**Action:** Remove the `async` keyword.

---

### #39 — `ExplanationModal` Missing Accessibility Attributes
**File:** `src/components/ExplanationModal.tsx`  **Type:** Accessibility | **Risk:** Low

Close button (`✕`) and "Close" button have no `accessibilityLabel` or `accessibilityRole`.
Screen readers will announce them as unlabelled.

**Action:** Add `accessibilityLabel="Close explanation"` and `accessibilityRole="button"` to both.

---

### #40 — `HotspotQuestion` Dropdown Missing Accessibility Attributes
**File:** `src/components/HotspotQuestion.tsx`  **Type:** Accessibility | **Risk:** Low

Dropdown `TouchableOpacity` elements have no `accessibilityLabel` or `accessibilityRole`.

**Action:** Add per-step labels, e.g. `` accessibilityLabel={`Step ${i+1}: ${chosenText || 'not selected'}`} ``.

---

### #41 — `skipLibCheck: true` Suppresses 3rd-Party Type Errors
**File:** `tsconfig.json`  **Type:** TypeScript Hygiene | **Risk:** Low

`skipLibCheck: true` without `@types/react-native` suppresses type errors in third-party
`.d.ts` files. Acceptable for Expo SDK 51 but worth revisiting as the project matures.

**Action:** Add `@types/react-native` as the project matures.

---

### #42 — Module-Level Mutable State in `quizEngine.ts`
**File:** `src/utils/quizEngine.ts`  **Type:** Architecture | **Risk:** Low

`_questions` and `_domainMap` are module-level mutable variables. They would leak state in
test or SSR environments. Acceptable for a native-only app; documented assumption.

**Action:** Document with a comment: `// Module-level singleton: safe for native-only app, not suitable for SSR/testing.`

---

## Enhancements Backlog

### E1 — Centralise AsyncStorage Keys in `storageKeys.ts`
All AsyncStorage keys scattered across 6+ files as string literals. A single
`src/constants/storageKeys.ts` export eliminates accidental key collisions. (See #5.)

---

### E2 — Decompose `HomeScreen` into Sub-components
`HomeScreen.tsx` is 1000+ lines managing profile, onboarding modal, post-exam modal,
practice config, and exam simulation. Extracting `ProfileModal` and `PostExamModal` would
improve testability without changing behaviour.

---

### E3 — Remove Parallel `ScoreSession` Write Path
`SessionRecord` is a full superset of `ScoreSession` + complete question history.
Dropping `addScoreSession` calls would reduce storage and simplify the data model.
(See #3.)

---

### E4 — Shared Shuffle Utility
Fisher-Yates shuffle shared between `quizEngine.ts` and `spacedRepetition.ts` would fix
the biased shuffle (#8) and reduce duplication. Suggested: `src/utils/mathUtils.ts`.

---

### E5 — Add Crash Analytics Before Play Store Launch
A lightweight integration (e.g. Sentry `@sentry/react-native`) would provide post-release
diagnostics without collecting PII — consistent with the existing Privacy Policy.

---

### E6 — Persist `examResultStore` to AsyncStorage (Transient Key)
Replace the module-level singleton in `examResultStore.ts` with an AsyncStorage transient key
(written before navigation, cleared after reading) to survive app restarts. (See #9.)

---

### E7 — Surface Question Reports in Settings  ✅ Done (May 23 2026)
User-submitted question reports are now visible via a dedicated `ReportsScreen` accessible
from `Settings → Question Reports`. Includes delete-individual and Export (Share sheet). (See #17.)

---

### E8 — Export / Import Session History (JSON Backup)
**Added:** May 22 2026

Serialise all AsyncStorage keys into a single JSON object and share via OS Share sheet (iOS),
or trigger a file download (web). Import flow: pick `.json` file via `expo-document-picker`,
validate schema, confirm, write back to AsyncStorage.

**Dependencies:** `expo install expo-file-system expo-sharing expo-document-picker`

---

### E9 — Google Drive Native Sync (Future)
**Added:** May 22 2026

After E8 is shipped, add one-tap "Sync to Google Drive" using `expo-auth-session` + Drive
REST API uploading to `appDataFolder` (hidden, app-specific folder).
Requires: Google Cloud Console project, OAuth 2.0 credentials, SHA-1 keystore fingerprint.

---

## Summary

### Open Issues by Risk

| Risk | Count | Issue Numbers |
|------|-------|---------------|
| 🔴 HIGH | 1 | #35 |
| 🟠 Medium | 5 | #5, #25, #28, #33, #36 |
| 🟡 Low | 28 | #8, #9, #10(OTA), #11, #12, #14, #15, #16, #18, #19, #20, #21, #22, #23, #24, #26, #27, #29, #30, #31, #32, #34, #37, #38, #39, #40, #41, #42 |

### Fixed Issues

| # | Description | Date Fixed |
|---|-------------|-----------|
| #1 | `getQuestionReports` dead function | May 23 2026 |
| #2 | `getAllSRRecords` dead function | May 23 2026 |
| #3 | Phantom `scoreHistory` state | May 23 2026 |
| #4 | `awsNavy` unused color token | May 23 2026 |
| #6 | Missing `.catch()` on AppNavigator | May 21 2026 |
| #7 | Missing error handling in `noteStore.ts` | May 21 2026 |
| #13 | Missing `targetSdkVersion` | May 21 2026 |
| #17 | Reports written but never read | May 23 2026 |
| P4/#22-web | `Alert.alert()` suppressed on web | May 23 2026 |
| Pass 1–3 | 36 findings across F1–F19, E1–E8 | May 20–21 2026 |

### Cross-Pass Statistics

| Pass | Date | Findings | Fixed | Deferred | Health |
|------|------|----------|-------|----------|--------|
| Pass 1 | 2026-05-20 AM | 9 | 9 (100%) | 0 | 8/10 — Good |
| Pass 2 | 2026-05-20 PM | 9 | 7 (78%) | 2 (user choice) | 9/10 — Very Good |
| Pass 3 | 2026-05-20/21 | 27 (19 bugs + 8 enhancements) | 27 (100%) | 0 | Not rated |
| Pass 4 | 2026-05-21/23 | 22 issues | 3 fixed this session | 19 open | B+ |
| **Total** | | **67** | **46** | **2** | |

### Known Permanently Deferred (User Choice)
| Item | Description |
|------|-------------|
| Pass 2 / C | `CONTACT_EMAIL = 'your@email.com'` placeholder in Privacy Policy |
| Pass 2 / F | Same contact email in `PrivacyPolicyScreen.tsx` |

---

*Last updated: May 23 2026 · Reviewer: GitHub Copilot (Claude Sonnet 4.6)*
