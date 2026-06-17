# Microsoft Ads API Setup - Complete Guide

Walk-through for setting up Microsoft Advertising (Bing Ads) API access.

## What We Need to Set Up

1. **Azure App Registration** (OAuth client)
2. **Developer Token** (from Microsoft Advertising)
3. **OAuth Refresh Token** (for automated API access)
4. **Helper scripts** (to make API calls)

---

## Step 1: Azure App Registration

### 1a. Register the App
- Go to: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
- Click **"New registration"**
- **Name:** Choose any name (avoid using "Microsoft" in the name - Azure blocks trademarked names)
- **Supported account types:** Select the **3rd option** - "Accounts in any organizational directory AND personal Microsoft accounts" (this is critical - personal MS accounts are required for Bing Ads API)
- **Redirect URI:** Select "Web" and enter `http://localhost:3847/callback`
- Click **Register**

### 1b. Save the Application (Client) ID
- On the app overview page, copy the **Application (client) ID**
- Save it - this is your `CLIENT_ID`

### 1c. Create a Client Secret
- In the left sidebar, click **"Certificates & secrets"**
- Click **"New client secret"**
- Description: "API Access" (or anything)
- Expiry: Choose your preference (24 months recommended)
- Click **Add**
- **IMMEDIATELY copy the "Value"** (not the Secret ID) - it only shows once
- Save it - this is your `CLIENT_SECRET`

### 1d. Verify Manifest Settings
- In the left sidebar, click **"Manifest"**
- Verify these values:
  - `"signInAudience": "AzureADandPersonalMicrosoftAccount"`
  - `"accessTokenAcceptedVersion": 2`
- If `accessTokenAcceptedVersion` is `null`, change it to `2` and click **Save**
- If `signInAudience` is wrong, you MUST set `accessTokenAcceptedVersion` to `2` FIRST, save, THEN change `signInAudience`

### 1e. Add API Permissions
- In the left sidebar, click **"API permissions"**
- Click **"Add a permission"**
- Click the **"APIs my organization uses"** tab
- Search for **"Microsoft Advertising"**
- If it doesn't appear, you need to create the service principal first (see Troubleshooting below)
- Select **"Microsoft Advertising"**
- Check **"msads.manage"** permission
- Click **"Add permissions"**
- Then click **"Grant admin consent"** (the blue button at the top)

### 1e (Troubleshooting): If Microsoft Advertising doesn't appear in API search
You need to create the Microsoft Advertising service principal in your Azure tenant:

```bash
# Install Azure CLI if not installed
brew install azure-cli  # macOS
# or: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

# Login (use --allow-no-subscriptions if you don't have an Azure subscription)
az login --allow-no-subscriptions

# Create the Microsoft Advertising API service principal
az ad sp create --id d42ffc93-c136-491d-b4fd-6f18168c68fd
```

After this, go back to API permissions and search again - "Microsoft Advertising" should now appear.

---

## Step 2: Get Developer Token

- Go to: https://developers.ads.microsoft.com/Account
- Sign in with your Microsoft Advertising account
- Your **Developer Token** will be displayed
- Save it - this is your `DEV_TOKEN`

Note: Developer tokens are free. If you see "Request Token", click it and it should be granted immediately for standard API access.

---

## Step 3: Generate OAuth Refresh Token

Run the token generation script:

```bash
node .claude/skills/microsoft-ads/scripts/get-refresh-token.js
```

**Before running:** Edit the script and fill in your `CLIENT_ID` and `CLIENT_SECRET`.

**IMPORTANT: Sign in with a PERSONAL Microsoft account** (e.g., outlook.com, hotmail.com, or a gmail.com linked to a Microsoft account). Work/school accounts will NOT work with the Bing Ads API. The personal account must be linked to your Microsoft Advertising manager account.

If you get "Can't sign in with a personal account here" error, check the Manifest settings (Step 1d).

Copy the `REFRESH_TOKEN` from the terminal output.

---

## Step 4: Save Credentials to .env

Add these to your `.env` file:

```
# Microsoft Ads API
MICROSOFT_ADS_CLIENT_ID=your_client_id_here
MICROSOFT_ADS_DEVELOPER_TOKEN=your_developer_token_here
MICROSOFT_ADS_CLIENT_SECRET=your_client_secret_value_here
MICROSOFT_ADS_REFRESH_TOKEN=your_refresh_token_here
```

---

## Step 5: Discover Your Accounts

First API call should be to get your user info and all accessible accounts:

1. **GetUser** (Customer Management) - returns your user ID
2. **SearchAccounts** (Customer Management) - returns all customer IDs and account IDs

You'll need Customer ID and Account ID for all subsequent Campaign Management and Reporting calls.

---

## Key Gotchas

1. **Personal Microsoft account required** - Work/school Azure AD accounts cannot access the Bing Ads API
2. **Azure app must support personal accounts** - `signInAudience` must be `AzureADandPersonalMicrosoftAccount` and `accessTokenAcceptedVersion` must be `2`
3. **Refresh tokens rotate** - Every token exchange gives you a new refresh token. Always save the latest one
4. **Conversion goals are customer-scoped** - They belong to the customer, not the account
5. **Reports are async** - Submit, poll until "Success", download ZIP, extract CSV
6. **Report downloads are pre-signed** - the ReportDownloadUrl is a SAS-signed URL; download it directly with no auth header (the helper does this for you)
7. **SOAP namespaces matter** - Each service has its own namespace
8. **Cost values in micros** - Divide by 1,000,000
9. **CTR as decimals** - Multiply by 100 for percentage
10. **Port conflicts** - If port 3847 is in use: `lsof -ti:3847 | xargs kill -9`
11. **Microsoft Advertising service principal** - If not found in API permissions, create it with Azure CLI (see Step 1e Troubleshooting)
