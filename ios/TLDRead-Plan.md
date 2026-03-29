# TLDRead — iOS Newsletter TLDR Widget App

## Overview

A native iOS app with a WidgetKit home screen widget that connects to Gmail, discovers newsletter senders, fetches their content, and generates TLDR summaries using the Anthropic API. No backend — everything runs on-device.

## Architecture

- **Platform:** iOS 17+, SwiftUI, @Observable macro
- **Auth:** Google Sign-In SDK (OAuth2, gmail.readonly scope)
- **Email:** Gmail REST API (direct URLSession calls)
- **AI:** Anthropic Messages API (claude-sonnet-4-20250514, direct URLSession calls)
- **Storage:** Keychain (API key + tokens), App Group UserDefaults (cached TLDRs, settings)
- **Widget:** WidgetKit with StaticConfiguration, small/medium/large sizes
- **Pattern:** MVVM with @Observable ViewModels, @MainActor

## Project Structure

```
TLDRead/
├── .gitignore
├── Package.swift                          # SPM: GoogleSignIn-iOS v8.0.0+
├── README.md
├── TLDRead.xcodeproj/
│   └── project.pbxproj                    # Two targets: app + widget extension
│
├── Shared/                                # Both targets
│   ├── AppGroupConstants.swift            # App Group ID, UserDefaults keys
│   └── SharedModels.swift                 # TLDRSummary, TrackedSender, Newsletter
│
├── TLDRead/                               # Main app target
│   ├── Info.plist                         # URL schemes (Google + tldread://)
│   ├── TLDRead.entitlements               # App Groups + Keychain
│   ├── TLDReadApp.swift                   # @main, onOpenURL for Google Sign-In
│   │
│   ├── Services/
│   │   ├── KeychainHelper.swift           # SecItem CRUD for API key storage
│   │   ├── GoogleAuthService.swift        # GIDSignIn wrapper, token refresh
│   │   ├── GmailService.swift             # Fetch senders, newsletters, MIME parsing
│   │   ├── AnthropicService.swift         # TLDR generation via Messages API
│   │   └── SharedDataStore.swift          # App Group UserDefaults CRUD, widget reload
│   │
│   ├── ViewModels/
│   │   ├── AuthViewModel.swift            # Sign-in/out, session restore
│   │   ├── SenderViewModel.swift          # Discover senders, toggle tracking
│   │   └── NewsletterViewModel.swift      # Fetch + summarize orchestration
│   │
│   └── Views/
│       ├── ContentView.swift              # TabView: TLDRs, Senders, Settings
│       ├── SignInView.swift               # Google Sign-In button
│       ├── SenderPickerView.swift         # Searchable sender list with toggles
│       ├── NewsletterListView.swift       # Pull-to-refresh TLDR list
│       ├── NewsletterDetailView.swift     # Full TLDR detail card
│       └── SettingsView.swift             # API key, refresh interval, sign out
│
└── TLDReadWidget/                         # Widget extension target
    ├── TLDReadWidget.entitlements         # App Groups only
    ├── TLDREntry.swift                    # TimelineEntry with placeholder data
    ├── TimelineProvider.swift             # Reads cached TLDRs from App Group
    ├── TLDReadWidget.swift                # StaticConfiguration, all 3 families
    ├── TLDReadWidgetBundle.swift          # @main WidgetBundle
    └── Views/
        ├── SmallWidgetView.swift          # 1 TLDR, deep link
        ├── MediumWidgetView.swift         # 2-3 TLDRs with indicators
        └── LargeWidgetView.swift          # Header + 4-5 TLDRs
```

## Setup Steps

### 1. Google Cloud Console

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Gmail API**
3. Create an **OAuth 2.0 Client ID** (iOS type)
4. Set the bundle ID to `com.medetzhakupov.TLDRead`
5. Download the `GoogleService-Info.plist`
6. Note the `CLIENT_ID` — you'll need it for `Info.plist` and `GoogleAuthService.swift`

### 2. Xcode Project Setup

1. Open `TLDRead.xcodeproj`
2. Resolve the SPM dependency (GoogleSignIn-iOS will auto-fetch)
3. In `Info.plist`, replace `YOUR_CLIENT_ID` with the reversed client ID from Google (e.g., `com.googleusercontent.apps.123456`)
4. In `GoogleAuthService.swift`, replace the `clientID` constant with your actual client ID
5. Verify App Group `group.com.medetzhakupov.TLDRead` is enabled for both targets in Signing & Capabilities
6. Set your development team for both targets

### 3. Anthropic API Key

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Enter it in the app's Settings tab — stored securely in iOS Keychain

## Data Flow

```
┌─────────────────────────────────────────────────┐
│                    User                          │
│  1. Signs in with Google                         │
│  2. Picks newsletter senders to track            │
│  3. Enters Anthropic API key in Settings         │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│              NewsletterViewModel                  │
│  1. Calls GmailService.fetchNewsletters()        │
│     → Gmail API: list messages by sender         │
│     → Gmail API: get full message (MIME parse)   │
│  2. Filters already-summarized emails            │
│  3. Calls AnthropicService.generateTLDR()        │
│     → POST api.anthropic.com/v1/messages         │
│     → Model: claude-sonnet-4-20250514            │
│     → max_tokens: 256                            │
│     → Rate limited: 1 req/sec                    │
│  4. Saves TLDRSummary to SharedDataStore         │
│     → App Group UserDefaults (max 50 cached)     │
│     → Triggers WidgetCenter.reloadAllTimelines() │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│              WidgetKit Extension                  │
│  TimelineProvider reads from App Group            │
│  Displays cached TLDRs (no network calls)        │
│  Refresh policy: .after(date) per user setting   │
│  Deep links via tldread:// URL scheme            │
└──────────────────────────────────────────────────┘
```

## Key Implementation Details

### Gmail Service

- **Sender discovery query:** `category:promotions OR label:newsletters`
- **Per-sender query:** `from:{email}` with date filter
- **MIME parsing:** prefers `text/plain`, falls back to HTML with tag stripping
- **Encoding:** Base64URL decoding for Gmail message bodies
- **Concurrency:** Batch fetching via `TaskGroup`

### Anthropic Service

- **System prompt:** "You are a newsletter summarizer. Provide a concise 2-3 sentence TLDR..."
- **Rate limiting:** 1 second delay between batch calls
- **Error handling:** API errors and rate limit responses

### Widget Sizes

| Size   | Content                                      |
|--------|----------------------------------------------|
| Small  | 1 TLDR (sender + subject + snippet)          |
| Medium | 2-3 TLDRs with blue dot new-indicators       |
| Large  | Header + 4-5 TLDRs with subject + 2-line summary |

- Placeholder data for preview/loading states
- Deep links open the app to the specific TLDR

### Security

- API key in Keychain with `kSecAttrAccessibleAfterFirstUnlock`
- OAuth tokens managed by Google Sign-In SDK
- Read-only Gmail scope (`gmail.readonly`)
- No backend — data only leaves device to Gmail API and Anthropic API

## Getting the Code

All 31 source files are on GitHub at `medetzhakupov/captioncraft`, branch `claude/ios-gmail-newsletter-widget-jSpFy`, under the `ios/` directory.

To copy to the NewsTLDR repo:

```bash
git clone -b claude/ios-gmail-newsletter-widget-jSpFy --single-branch \
  https://github.com/MedetZhakupov/captioncraft.git /tmp/src

git clone https://github.com/MedetZhakupov/NewsTLDR.git /tmp/NewsTLDR
cd /tmp/NewsTLDR

cp -r /tmp/src/ios/* .
cp /tmp/src/ios/.gitignore .

git add -A
git commit -m "Initial implementation of TLDRead iOS app"
git push origin main
```

Then open `TLDRead.xcodeproj` in Xcode, configure your Google Client ID, and build.
