# Google Play Store Submission Guide

> **App:** AWS AI Practitioner Prep (`com.awsquiz.aifpractitioner`)
> **Technical Name:** `aws-ai-practitioner-prep`
> **Last updated:** June 15, 2026 (Sync with Gold Build)

This is a self-contained checklist for uploading this app to Google Play Console.
Every question Play Console will ask you, with the exact answer that matches the
shipping code + the published privacy policy.

---

## Part 1 — Before You Open Play Console

### 1.1 Bump version (Local source of truth)

Edit [app.json](app.json):
- `expo.version` → bump for users (e.g. `1.0.0` → `1.0.1`)
- `expo.android.versionCode` → **must increment** for every AAB upload (use **6** or higher if version 4/5 were rejected)

Note: `eas.json` is configured with `appVersionSource: "local"`, so the values in `app.json` will be respected during builds.

### 1.2 Build the AAB

Run from your project root:
```powershell
eas build --platform android --profile production
```

Wait for EAS to finish (usually 10–20 min). Download the `.aab` file from the EAS dashboard.

### 1.3 Re-host the privacy policy

Push the updated `privacy-policy.html` to wherever it's currently hosted
(GitHub Pages, Netlify, etc.). The URL must remain the same as what you give
to Play Console below — and the HTML there must match the version in this repo.
**Recommended URL:** `https://sudes16.github.io/aws-ai-practitioner/privacy-policy.html` (verify your hosting)

### 1.4 Take screenshots

Play Console requires at least **2 phone screenshots** (recommended: 4–8). Capture from
a real device or Android Studio emulator at portrait orientation:
- Home screen with countdown banner
- Quiz screen (a question mid-answer)
- Insights screen (any tab)
- Results / Exam summary
- Settings (showing local-only data)

Image specs: **9:16 or 16:9 aspect ratio, min 320px, max 3840px on the long side, PNG or JPEG**.

### 1.5 Prepare graphic assets

| Asset | Size | Source |
|---|---|---|
| App icon | 512 × 512 PNG | Re-export `assets/icon.png` at 512×512 (don't upload the 1024 directly — Play Console wants 512) |
| Feature graphic | 1024 × 500 PNG/JPEG | **Required.** Create a banner: navy `#1A2B4C` background, app name "AWS AI Practitioner Prep" in white, "AIF-C01 Quiz" in orange, cloud+cap logo on left. |
| Phone screenshots | 320–3840 px | See 1.4 |

---

## Part 2 — Play Console Walkthrough

### 2.1 Create the app

**Console → All apps → Create app**

| Field | Answer |
|---|---|
| App name | `AWS AI Practitioner Prep` |
| Default language | English (United States) – en-US |
| App or game | **App** |
| Free or paid | **Free** |
| Declarations: developer program policies | ✅ Accept |
| Declarations: US export laws | ✅ Accept |

### 2.2 Set up your app (top dashboard)

You will see a checklist of items. Each is covered below.

---

## Part 3 — Every Question Play Console Will Ask

### 3.1 App access

> "Is all functionality in your app available without any access restrictions?"

**Answer: YES — all functionality is available without restrictions.**

> "Do users need to log in to use your app?"

**Answer: NO.**

(No demo credentials needed — there is no login at all.)

---

### 3.2 Ads

> "Does your app contain ads?"

**Answer: NO.**

---

### 3.3 Content rating

You'll fill out the IARC questionnaire. Answer truthfully — for this app, all
the following are **NO**:

| Question category | Answer |
|---|---|
| Violence (cartoon, fantasy, realistic) | No |
| Sexual content / nudity | No |
| Profanity / crude humor | No |
| Controlled substances / drugs | No |
| Gambling / simulated gambling | No |
| Horror / fear content | No |
| User-generated content sharing | No |
| Location sharing | No |
| Personal information sharing | No |
| Digital purchases | No |

**Expected rating: Everyone (PEGI 3 / ESRB E).**

---

### 3.4 Target audience and content

| Question | Answer |
|---|---|
| Target age groups | **18 and over** (this is exam prep for adult professionals) |
| Does your app unintentionally appeal to children? | **No** |
| Does your app have a children-mixed audience? | **No** |

---

### 3.5 News app

> "Is this a news app?"

**Answer: NO.**

---

### 3.6 COVID-19 contact tracing / status apps

> "Is this a contact tracing or status app?"

**Answer: NO.**

---

### 3.7 Data safety (the big one — match these exactly)

This section is critical and must match the privacy policy word-for-word in intent.

> "Does your app collect or share any of the required user data types?"

**Answer: NO.**

> "Is all of the user data collected by your app encrypted in transit?"

**Answer: N/A** (no data is collected or transmitted to your servers — Gemini API
calls go directly from the user's device to Google over HTTPS, which you should
note in the optional comment).

> "Do you provide a way for users to request that their data be deleted?"

**Answer: YES.** Justification: "Users can uninstall the app to remove all data,
or use the in-app Settings tab to reset specific data categories. All data is
stored locally on the device."

#### Data types — answer NO to every category

| Data category | Answer |
|---|---|
| Location (approximate, precise) | NO |
| Personal info (name, email, address, phone, race, religion, sexual orientation, etc.) | NO |
| Financial info | NO |
| Health and fitness | NO |
| Messages | NO |
| Photos and videos | NO |
| Audio files | NO |
| Files and docs | NO |
| Calendar | NO |
| Contacts | NO |
| **App activity** (interactions, search history, installed apps, other) | NO |
| Web browsing | NO |
| App info and performance (crash logs, diagnostics, other) | NO |
| **Device or other IDs** | NO |

> "But wait — the user enters their name in the profile?"

The profile name is **stored locally and never transmitted**. Play Console's
"data collection" question specifically means "data your app or its SDKs send
off the device." Local-only storage = NO data collection.

> "But wait — the app sends notifications. Doesn't that need FCM / a device token?"

**No.** The app uses **local notifications** scheduled via `expo-notifications`,
which the Android OS delivers using `AlarmManager` — no Firebase, no server, no
token. Notifications still fire even with no internet connection.

> "But wait — the Gemini API key the user pastes in?"

The user provides their own API key. It's stored locally and used only to
authenticate the user's own requests to Google. You (the developer) never see it.
You are not "collecting" it because it never leaves their device toward your server.

---

### 3.8 Government apps

> "Is this a government app?"

**Answer: NO.**

---

### 3.9 Financial features

> "Does your app provide financial features?"

**Answer: NO.**

---

### 3.10 Health features

> "Does your app provide health-related features?"

**Answer: NO.**

---

### 3.11 Permissions declaration

Play Console will list every permission your AAB declares and ask you to
justify or remove sensitive ones. Yours:

| Permission | Action |
|---|---|
| `INTERNET` | (auto-included; no declaration needed) |
| `POST_NOTIFICATIONS` | Standard, no declaration form needed |
| `VIBRATE` | Standard, no declaration form needed |
| `WAKE_LOCK` | Standard, no declaration form needed |
| `RECEIVE_BOOT_COMPLETED` | **May trigger a declaration request.** Justification: "Used to re-register the user's locally-scheduled study reminders after a device restart so notifications continue to fire at the times the user chose. No tracking or background data collection." |

You do **not** have any of the high-risk permissions that require the
"Sensitive permissions declaration" form (SMS, Call Log, Accessibility,
All Files Access, etc.). Good.

---

### 3.12 Store listing (main app page)

| Field | Answer |
|---|---|
| App name | `AWS AI Practitioner Prep` |
| Short description (80 chars) | `Master the AWS Certified AI Practitioner (AIF-C01) exam with smart practice.` |
| Full description (4000 chars) | See **Part 4** below |
| App icon | Upload 512×512 version of `assets/icon.png` |
| Feature graphic | 1024×500 banner (see 1.5) |
| Phone screenshots | At least 2, ideally 4–8 |
| App category | **Education** |
| Tags | `Education`, `Test prep` |
| Email | `sudesh6112@gmail.com` |
| Website (optional) | Your GitHub Pages URL if you want |
| Privacy Policy URL | **Required.** The hosted `privacy-policy.html` URL. |

---

### 3.13 Pricing and distribution

| Field | Answer |
|---|---|
| Countries / regions | Select countries (start with India + US if it's your first app) |
| Free or paid | Free |
| Contains ads | No |

---

## Part 4 — Store Listing Description (Copy/Paste)

### Short description (80 chars)

```
Master the AWS Certified AI Practitioner (AIF-C01) exam with smart practice.
```

### Full description (paste into Play Console)

```
🎯 AWS AI Practitioner Prep — your offline-first study companion for the AIF-C01 exam.

Built for serious candidates who want focused practice without ads, accounts, or
data collection. Everything stays on your device.

✨ FEATURES

📝 PRACTICE MODE
• Configure by question range, count, or type
• Random, sequential, weak-mode, and spaced-repetition orderings
• Multiple choice + matching question types

🎓 EXAM SIMULATION
• Full 65-question mock exam, domain-weighted
• 90-minute timer
• Review grid before final submission

📊 INSIGHTS & TRACKING
• Animated learning-curve chart
• Score distribution, streaks, question coverage
• Per-session history with retry-wrong drill

✨ AI INSIGHTS (Optional)
• Bring your own Google Gemini API key (free tier available)
• Get plain-English "Deep Dive" explanations on any question
• Your key is stored only on your device

🔔 STUDY REMINDERS
• Schedule custom local notifications
• Works completely offline
• Survives device restarts

🔒 PRIVACY-FIRST
• 100% local storage — no account required
• No analytics, no ads, no tracking
• No data sent to our servers (we don't have any)

📖 STUDY MODES
• Study mode: instant feedback + explanations
• Test mode: submit answers, review at the end
• Timed mode: simulates real exam pressure

📌 NOT AFFILIATED WITH AWS
This is an independent study tool. AWS, the AWS logo, and AWS service names
are trademarks of Amazon.com, Inc. or its affiliates.
```

---

## Part 5 — Final Pre-Submit Checklist

Before clicking **Submit for review**:

- [ ] Bumped `versionCode` in `app.json`
- [ ] Built fresh AAB via EAS (production profile)
- [ ] Privacy Policy URL is live and matches the in-repo `privacy-policy.html`
- [ ] App name in store listing exactly matches `expo.name` in `app.json`: `AWS AI Practitioner Prep`
- [ ] Icon uploaded at 512×512
- [ ] Feature graphic uploaded at 1024×500
- [ ] At least 2 phone screenshots uploaded
- [ ] Content rating questionnaire completed (expect "Everyone")
- [ ] Data Safety section answers match Part 3.7 above
- [ ] Target audience set to **18 and over**
- [ ] Categorized as **Education**
- [ ] Contact email set to `sudesh6112@gmail.com`
- [ ] Tested the AAB on a real Android device or emulator

---

## Part 6 — After Submission

Google's review typically takes **1–7 days** for first-time apps (sometimes longer).

You may receive an email asking for:
- Clarification on a permission (already pre-justified above for `RECEIVE_BOOT_COMPLETED`)
- A demo video if a reviewer can't figure out a feature
- Trademark confirmation if they question the "AWS" in the name — respond with the
  disclaimer text from `privacy-policy.html` §6 and the footer

If rejected, fix the cited issue and resubmit — does **not** require a versionCode bump
if you didn't change the binary.

---

## Part 7 — Common Rejection Reasons (Be Prepared)

| Reason | Mitigation already in place |
|---|---|
| Trademark / impersonation | App name has "Prep" qualifier; disclaimer in §6 + footer |
| Data Safety mismatch | Policy says "no data collected"; form will say the same |
| Missing privacy policy URL | URL is required field; you'll provide it in 3.12 |
| Permissions not justified | Only standard permissions; BOOT pre-justified in §4 |
| Content rating misdeclared | Honest answers → expect "Everyone" rating |
| Children's privacy violations | Target audience set to 18+, no children's content |

---

**You're ready. Good luck.**
