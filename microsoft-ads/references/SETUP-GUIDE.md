# Microsoft Ads API Setup Guide

Complete walkthrough for setting up Microsoft Advertising (Bing Ads) API access.

## What You Need

1. Azure App Registration (OAuth client)
2. Developer Token (from Microsoft Advertising)
3. OAuth Refresh Token (for automated API access)

---

## Step 1: Azure App Registration

### 1a. Register the App

- Go to: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
- Click **"New registration"**
- **Name**: Choose any name (avoid using "Microsoft" — Azure blocks trademarked names)
- **Supported account types**: Select the **3rd option** — "Accounts in any organizational directory AND personal Microsoft accounts" (critical — personal MS accounts are required for Bing Ads API)
- **Redirect URI**: Select "Web" and enter `http://localhost:3847/callback`
- Click **Register**

### 1b. Save the Application (Client) ID

- On the app overview page, copy the **Application (client) ID**
- Save it — this is your `CLIENT_ID`

### 1c. Create a Client Secret

- Left sidebar → **"Certificates & secrets"**
- Click **"New client secret"**
- Description: "API Access" (or anything)
- Expiry: 24 months recommended
- Click **Add**
- **IMMEDIATELY** copy the **"Value"** (not the Secret ID) — it only shows once
- Save it — this is your `CLIENT_SECRET`

### 1d. Verify Manifest Settings

- Left sidebar → **"Manifest"**
- Verify:
  - `"signInAudience": "AzureADandPersonalMicrosoftAccount"`
  - `"accessTokenAcceptedVersion": 2`
- If `accessTokenAcceptedVersion` is null, change it to 2 and click Save
- If `signInAudience` is wrong: set `accessTokenAcceptedVersion` to 2 FIRST, save, THEN change `signInAudience`

### 1e. Add API Permissions

- Left sidebar → **"API permissions"**
- Click **"Add a permission"**
- Click the **"APIs my organization uses"** tab
- Search for **"Microsoft Advertising"**
- Select it, check **"msads.manage"** permission
- Click **"Add permissions"**
- Click **"Grant admin consent"** (blue button at top)

### 1e Troubleshooting: Microsoft Advertising Not Found

If "Microsoft Advertising" doesn't appear in the API search, create the service principal first:

```bash
# Install Azure CLI if needed
brew install azure-cli

# Login (use --allow-no-subscriptions if no Azure subscription)
az login --allow-no-subscriptions

# Create the Microsoft Advertising API service principal
az ad sp create --id d42ffc93-c136-491d-b4fd-6f18168c68fd
```

Then go back to API permissions and search again.

---

## Step 2: Get Developer Token

- Go to: https://developers.ads.microsoft.com/Account
- Sign in with your Microsoft Advertising account
- Your Developer Token will be displayed
- Save it — this is your `DEV_TOKEN`

Note: Developer tokens are free. If you see "Request Token", click it — should be granted immediately.

---

## Step 3: Generate OAuth Refresh Token

```bash
node .claude/skills/microsoft-ads/scripts/get-refresh-token.cjs YOUR_CLIENT_ID YOUR_CLIENT_SECRET
```

- Opens a URL — paste it into your browser
- **Sign in with a PERSONAL Microsoft account** (outlook.com, hotmail.com, or gmail linked to MS account)
- Work/school accounts will NOT work with the Bing Ads API
- The personal account must be linked to your Microsoft Advertising manager account
- Copy the `REFRESH_TOKEN` from terminal output

If you get "Can't sign in with a personal account here" error, check the Manifest settings (Step 1d).

---

## Step 4: Save Credentials

Add to your `.env` file at the brain root:

```
# Microsoft Ads API
MICROSOFT_ADS_CLIENT_ID=your_client_id_here
MICROSOFT_ADS_DEVELOPER_TOKEN=your_dev_token_here
MICROSOFT_ADS_CLIENT_SECRET=your_client_secret_value_here
MICROSOFT_ADS_REFRESH_TOKEN=your_refresh_token_here
```

---

## Step 5: Verify Setup

```bash
node .claude/skills/microsoft-ads/scripts/get-accounts.cjs
```

This should list all your accessible Microsoft Advertising accounts.

Save the Customer ID and Account ID for the account(s) you want to query. Optionally add to `.env`:

```
MSADS_CUSTOMER_ID=your_customer_id
MSADS_ACCOUNT_ID=your_default_account_id
```

---

## Key Gotchas

1. **Personal Microsoft account required** — Work/school Azure AD accounts cannot access the Bing Ads API
2. **Azure app must support personal accounts** — signInAudience must be `AzureADandPersonalMicrosoftAccount`, accessTokenAcceptedVersion must be 2
3. **Refresh tokens rotate** — Every token exchange gives a new refresh token. The auth script auto-saves it to `.env`
4. **Conversion goals are customer-scoped** — They belong to the customer, not the account
5. **Reports are async** — Submit, poll for completion, download ZIP containing CSV
6. **Report downloads need auth** — Download URL requires the AuthenticationToken header
7. **SOAP namespaces matter** — Each service has its own namespace
8. **Cost values are in micros** — Divide by 1,000,000 for actual currency
9. **CTR values are decimals** — Multiply by 100 for percentage
10. **Port 3847 conflicts** — If in use when running OAuth: `lsof -ti:3847 | xargs kill -9`
