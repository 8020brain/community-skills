# Connecting Microsoft Advertising via the API (Community Guide)

This is a battle-tested setup, written for anyone hitting the two walls people keep getting stuck on:

1. **"The ability to create applications outside of a directory has been retired."** (the Azure registration wall)
2. **"Action required: Please contact Microsoft Advertising Support regarding your API access request."** (the developer token wall)

Both are solvable for free. Microsoft's wording makes them sound like paywalls. They are not. Read the two "Wall" sections first, then do the clean setup.

You need four credentials at the end:

```
MICROSOFT_ADS_CLIENT_ID=...        (36 chars, a GUID)
MICROSOFT_ADS_CLIENT_SECRET=...    (~40 chars, the secret VALUE not the ID)
MICROSOFT_ADS_DEVELOPER_TOKEN=...  (~16 chars)
MICROSOFT_ADS_REFRESH_TOKEN=...    (long, ~450+ chars, auto-rotates after first use)
```

---

## Wall 1: "Create applications outside of a directory has been retired"

### What is actually happening

Microsoft turned off app registration for plain personal Microsoft accounts that have **no Entra ID (Azure AD) directory** attached. You are not being asked to pay. You are being asked to have a **directory/tenant** to register the app in.

Key distinction that causes the panic:

- An **Azure subscription** (VMs, storage, compute) is the thing with a 30-day trial that becomes paid. You do **not** need one.
- A **Microsoft Entra ID directory/tenant** with **app registrations** is **free forever**. App registrations cost nothing. This is all you need.

### The fix (free, ~5 minutes)

You have two free directory options. Either works. Pick one.

**Option A: Create a free Entra ID tenant (cleanest, recommended)**

1. Go to **https://entra.microsoft.com** (Microsoft Entra admin center).
2. Sign in with your Microsoft account.
3. In the left nav: **Identity > Overview > Manage tenants** (or search "Manage tenants").
4. Click **Create**.
5. Choose **Microsoft Entra ID** (the workforce option). **Do NOT** choose "External" or "B2C" - those are different products.
6. Fill in: Organization name (anything, e.g. "Personal Ads"), Initial domain name (e.g. `yournamehere`, becomes `yournamehere.onmicrosoft.com`), Country.
7. Click **Review + create > Create**. Pass the captcha. Done. This tenant is free permanently.
8. Switch into the new tenant: click the **Settings/gear icon** (top right) > **Switch directory** > pick the new one.
9. Now go to **App registrations > New registration**. It works.

**Option B: Use the M365 Developer Program tenant you already signed up for**

If you joined the Microsoft 365 Developer Program, you already have a free tenant. The reason it "looked unhelpful" is you have to switch into it first:

1. Go to **https://portal.azure.com**.
2. Top right: **Settings (gear) > Switch directory**.
3. Select the tenant whose domain looks like `xxxxxx.onmicrosoft.com` (your dev program tenant, not "Default Directory" / "Microsoft Services").
4. Now **App registrations > New registration** works.

### Wall 1 also explains Hana's Entra error

> "Selected user account does not exist in tenant 'Microsoft Services' and cannot access the application 'f988...7541' in that tenant."

That `f988...` app and the "Microsoft Services" tenant belong to **Microsoft's own** advertising sign-in, not yours. You hit this when the app is registered single-tenant, or you are signing in against the wrong directory. The clean setup below avoids it entirely by:

- registering the app as **multi-tenant + personal Microsoft accounts**, and
- running the OAuth flow against `/common` (the script already does this) so it does not matter which directory the app lives in.

---

## Wall 2: Developer token "contact Microsoft Advertising Support"

### What is actually happening

When you request a developer token at https://developers.ads.microsoft.com/Account you get a token string **immediately**. Microsoft then sends a standard compliance email. That email is **not always a block**. There are three realities:

1. **The token often already works for production.** People assume the email means "blocked" and stop. Test it first (see "Verify" step below) before assuming anything. Many tokens are live the moment they are issued.
2. **Brand-new empty accounts get flagged more.** Tokens requested on a Microsoft Advertising account with **no billing history and no ad spend** trigger manual review far more often. Established accounts with active spend sail through. If you can, request the token from an account that already has a payment method and live campaigns.
3. **If it is genuinely gated**, reply to that exact email (or open a ticket via the developer portal) with: your Microsoft Advertising **Account ID**, that you are using the API to **manage your own / your clients' advertising accounts** (not building a public-facing app), and that you need **standard production access**. Approval is typically 1-3 business days. Be specific and boring; vague requests get bounced.

### Sandbox shortcut while you wait

The developer token works in the **sandbox** immediately, with no approval. Sandbox endpoints are `*.api.sandbox.bingads.microsoft.com` and need sandbox accounts (created at https://developers.ads.microsoft.com). Use this only to validate your OAuth + code path. Real client data needs production approval, so push on step 3 above in parallel.

---

## Clean Setup (do this once both walls are cleared)

### Step 1: Register the Azure app

In your free tenant (from Wall 1): **App registrations > New registration**.

- **Name:** anything **without** the word "Microsoft" (Azure blocks trademarked names).
- **Supported account types:** the option that says **"Accounts in any organizational directory (any Microsoft Entra ID tenant - multitenant) and personal Microsoft accounts"**. This is mandatory. It is what lets the personal account that owns your Bing Ads access authenticate, even though the app lives in a different directory.
- **Redirect URI:** type = **Web**, value = `http://localhost:3847/callback`
- **Register.**

### Step 2: Capture Client ID + create the secret

- On the **Overview** page, copy **Application (client) ID** -> this is `MICROSOFT_ADS_CLIENT_ID`.
- **Certificates & secrets > New client secret** > description anything, expiry 24 months > **Add**.
- Copy the **Value** immediately (NOT the Secret ID; the Value is shown once) -> this is `MICROSOFT_ADS_CLIENT_SECRET`.

### Step 3: Confirm the manifest

**Manifest** (left nav). Verify:

- `"signInAudience": "AzureADandPersonalMicrosoftAccount"`
- `"accessTokenAcceptedVersion": 2`

If `accessTokenAcceptedVersion` is `null`, set it to `2`, **Save**. If `signInAudience` is wrong, you must set `accessTokenAcceptedVersion` to `2` and save FIRST, then change `signInAudience`, then save again.

### Step 4: Add the Microsoft Advertising permission

**API permissions > Add a permission > APIs my organization uses** tab > search **"Microsoft Advertising"** > select it > check **`msads.manage`** > **Add permissions** > **Grant admin consent**.

If "Microsoft Advertising" does not show up in that search, create its service principal in your tenant once:

```bash
brew install azure-cli            # macOS, skip if you have it
az login --allow-no-subscriptions # the flag matters: you have no paid subscription
az ad sp create --id d42ffc93-c136-491d-b4fd-6f18168c68fd
```

Then re-search "Microsoft Advertising" in API permissions. It will appear.

### Step 5: Get the developer token

https://developers.ads.microsoft.com/Account -> sign in with the Microsoft account that has access to your Microsoft Advertising account -> copy the token -> `MICROSOFT_ADS_DEVELOPER_TOKEN`. (See Wall 2 if you get the support email.)

### Step 6: Generate the OAuth refresh token

Edit `scripts/get-refresh-token.js` and fill in `CLIENT_ID` and `CLIENT_SECRET` at the top. Then:

```bash
node scripts/get-refresh-token.js
```

It prints a URL. Open it. **Sign in with a PERSONAL Microsoft account** (outlook.com / hotmail.com / live.com, or a personal MS account that has been granted access to the Microsoft Advertising manager account). **Work/school accounts will not work with the Bing Ads API.** Approve. The terminal prints `REFRESH_TOKEN=...` -> that is `MICROSOFT_ADS_REFRESH_TOKEN`.

- "Can't sign in with a personal account here" -> manifest is wrong, redo Step 3.
- Port 3847 already in use -> `lsof -ti:3847 | xargs kill -9` then rerun.

### Step 7: Save to .env

In the skill folder `.env` (next to SKILL.md):

```
MICROSOFT_ADS_CLIENT_ID=your_client_id
MICROSOFT_ADS_CLIENT_SECRET=your_secret_value
MICROSOFT_ADS_DEVELOPER_TOKEN=your_dev_token
MICROSOFT_ADS_REFRESH_TOKEN=your_refresh_token
```

The refresh token **rotates on every use**. `msads-helper.js` automatically writes the new one back to `.env` for you, so do not be surprised when the value changes.

### Step 8: Verify it works

Ask your assistant: **"list my Microsoft Ads accounts"**. Under the hood this runs `GetUser` then `SearchAccounts`. If you get your user ID and account list back, you are fully connected. This is also the real test for Wall 2: if this returns data, your developer token is live regardless of the support email.

---

## Why this setup avoids the errors people hit

| Symptom | Root cause | This guide's fix |
|---|---|---|
| "Create applications outside of a directory has been retired" | Personal account with no Entra directory | Free Entra tenant or M365 dev tenant (Wall 1) - no Azure subscription needed |
| "Azure becomes paid after 30 days" | Confusing Azure *subscriptions* with Entra *directories* | App registrations + Entra ID directory are free forever |
| "User account does not exist in tenant 'Microsoft Services'" | App is single-tenant or wrong directory | Multi-tenant + personal accounts, OAuth via `/common` |
| "Contact Microsoft Advertising Support re: API access" | New/empty account flagged, or assuming the email = blocked | Test the token first; request from a spending account; reply with Account ID + use case |
| "Can't sign in with a personal account here" | Manifest not set for personal accounts | `signInAudience: AzureADandPersonalMicrosoftAccount` + `accessTokenAcceptedVersion: 2` |

---

## Key Gotchas (keep these in mind)

1. **Personal Microsoft account required** for the OAuth sign-in. Work/school accounts cannot use the Bing Ads API, no matter what.
2. **The app's directory does not matter** as long as it is multi-tenant + personal accounts. It can live in any free tenant.
3. **Refresh tokens rotate** every exchange. The helper saves the new one back automatically. Never hand-edit it mid-session.
4. **App registrations are free.** Only Azure compute subscriptions cost money, and you do not need one.
5. **The support email is often noise.** Verify with a real API call before concluding you are blocked.

---

*This guide documents a known-working production setup. It complements `SETUP.md` (the original step list) and `SKILL.md` (the API architecture). If you only read one file, read this one.*
