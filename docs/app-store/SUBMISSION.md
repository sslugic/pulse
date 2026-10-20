# Pulse 1.0: App Store submission checklist

Everything Claude could fill in is already done (✅). The ☐ items are declarations only you can make,
with the answers that match what the app actually does.

## Already done

- ✅ Privacy, Terms and Support pages: https://sslugic.github.io/pulse-site/ (repo `sslugic/pulse-site`)
- ✅ App Information: subtitle "AI Coach, Calories & Workouts"
- ✅ Version 1.0 page: promotional text, description, keywords, support and marketing URLs, copyright,
  review notes, "Sign-in required" unchecked
- ✅ 5 iPhone screenshots uploaded (Apple reuses them for every iPhone size): `docs/app-store/raw/`
- ✅ Build 4 archived (legal links, translations, streak fix). Uploaded from Xcode Organizer by you.

## You need to do (App Store Connect → Pulse)

### 1. App Information
- ☐ **Category:** Primary **Health & Fitness**, Secondary **Lifestyle**. Apple's category list wasn't loading earlier, so set this again and **Save**.
- ☐ **Content Rights → Set Up:** "Yes, it contains third-party content" → "I have the necessary rights". (Barcode lookups use Open Food Facts data, ODbL license.)
- ☐ **Age Rating → Edit:** answer honestly. Suggested answers:
  - Medical or treatment information: **Infrequent/Mild** (general fitness and nutrition guidance, with a disclaimer)
  - Health or wellness topics: **Yes**
  - Unrestricted web access, gambling, contests, user-to-user messaging or sharing: **No**
  - Violence, sexual content, profanity, alcohol/drugs, horror: **None**

### 2. App Privacy → Privacy Policy
- ☐ **Privacy Policy URL:** `https://sslugic.github.io/pulse-site/privacy.html` (Apple errored when Claude saved it, so check it's there).
- ☐ **Get Started → Data collection:** "Yes, we collect data". Mark each type below as **Linked to the user**, **Not used for tracking**, purpose **App Functionality** (except where noted):
  - **Contact Info → Email Address** (only if the user shares it via Sign in with Apple)
  - **Health & Fitness → Health** and **Fitness** (logs; Apple Health data that is read)
  - **User Content → Photos or Videos**, **Audio Data** (voice notes sent to the AI), **Other User Content** (chats, journal)
  - **Identifiers → User ID**
  - **Purchases → Purchase History**
  - **Usage Data → Product Interaction** (AI feature usage counts), purpose **Analytics** and **App Functionality**
  - Tracking: **No**, nothing is used to track users across apps or websites.
- ☐ **Publish** the App Privacy answers.

### 3. Pricing and Availability
- ☐ Price: **Free**. Availability: **all countries/regions** (or your choice).

### 4. Version 1.0 page
- ☐ **App Review Information → Contact:** your first and last name, phone (`+1…`), email.
- ☐ **Build:** "Add Build" → choose **4** once it has finished processing (it can take up to 30 minutes after upload).
- ☐ **In-App Purchases and Subscriptions:** "+" → select **100 Credits, 500 Credits, 1,500 Credits, Pulse Pro Monthly**. They are reviewed together with this first version.
- ☐ **App Store Version Release:** "Manually release this version" (recommended for the first launch) or automatic.
- ☐ **Save**, then **Add for Review** → **Submit for Review**. You will be asked about export compliance (Pulse only uses standard HTTPS, so the answer is "None of the algorithms mentioned"; the build already declares this) and the advertising identifier (**No**).

## Before or right after you submit
- In-app purchase prices: 1,500 Credits at **$24.99**; Pulse Pro description "600 AI credits every month…".
- Enroll in the **Apple Small Business Program** (developer.apple.com/app-store/small-business-program): 15% commission instead of 30%.
- **Rotate the RevenueCat webhook key.** The current one appeared in chat. Ask Claude to generate and install a new one.
