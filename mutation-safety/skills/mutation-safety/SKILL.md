---
name: mutation-safety
description: MANDATORY safety system for ALL Google Ads mutations AND destructive Google Sheets writes. Auto-invoke whenever ANY agent, skill, or script attempts to modify Google Ads accounts (add/update/delete campaigns, keywords, budgets, ads, etc.) OR overwrite/delete Google Sheets data. Enforces two-step approval: (1) dry-run preview with approval code, (2) user says "unlock and ready to post", (3) user says "POST NOW". Prevents accidental changes. Logs all mutations. This skill MUST be invoked before executing any Google Ads API write operations or destructive Sheets operations.
allowed-tools: [Read]
---

# Mutation Safety Skill

**Purpose:** Enforce two-step approval for ALL mutations to Google Ads accounts AND destructive Google Sheets writes.

**Type:** Safety enforcement skill (MANDATORY - auto-invokes for all mutations)

**Status:** Production - MUST BE USED FOR ALL LIVE CHANGES

**Covers:**
- Google Ads API mutations (campaigns, keywords, budgets, ads, etc.)
- Google Sheets overwrites/deletes (clearing tabs, replacing data)

---

## Installation

To install this skill in your Claude Code project:

1. Copy the entire `mutation-safety-skill/` folder to `.claude/skills/mutation-safety/`
2. The folder structure should be:
   ```
   .claude/skills/mutation-safety/
   ├── SKILL.md              # This file
   └── utils/
       ├── __init__.py
       ├── mutation_guard.py
       ├── mutation_logger.py
       └── sheets_write_guard.py
   ```
3. Claude will auto-detect and use this skill when mutations are attempted

---

## Core Principles

### 1. NO MUTATIONS WITHOUT TWO-STEP APPROVAL

Any agent, script, or skill that wants to make changes to Google Ads accounts MUST use the MutationGuard system.

### 2. EXACT MATCH REQUIRED FOR ALL IDENTIFIERS

**ALL mutations MUST use exact matching for identifiers to prevent accidental modifications.**

**Identifiers requiring exact match:**
- **Customer IDs (CIDs)** - Must match exactly (no partial CID matching)
- **Conversion action names** - Must use `= 'name'` not `LIKE '%name%'`
- **Campaign names** - Must use exact name matching
- **Ad group names** - Must use exact name matching
- **Keyword text** - Must use exact text matching
- **Any other named entity** - Default to exact match

**Implementation:**
- Scripts MUST default to exact match (no flag needed)
- Pattern matching requires explicit `--pattern` flag to opt-in
- GAQL queries MUST use `= 'value'` instead of `LIKE '%value%'` for mutations
- Pattern/partial matching is ONLY allowed for read-only queries (reports, audits)

**Why this matters:**
- Prevents renaming "Form_Submit" when you meant "Form_Submit_BC"
- Prevents modifying account `9125741649` when you meant `9125749164`
- One character difference can affect the wrong entity

**Example - Correct:**
```sql
WHERE conversion_action.name = 'Form_Application-Submit_BC'
```

**Example - WRONG for mutations:**
```sql
WHERE conversion_action.name LIKE '%Application-Submit%'
```

---

## When to Auto-Invoke This Skill

Claude should invoke this skill **automatically** whenever:

1. User asks to make changes to Google Ads accounts
2. Agent is about to execute mutations
3. Script is preparing to write to Google Ads API
4. Any operation that uses these Google Ads API services:
   - `CampaignService.mutate_campaigns`
   - `AdGroupService.mutate_ad_groups`
   - `KeywordPlanService.mutate_keywords`
   - `SharedSetService.mutate_shared_sets`
   - `SharedCriterionService.mutate_shared_criteria`
   - Any other `mutate_*` or `create_*` or `update_*` or `remove_*` methods

**Examples that trigger this skill:**
- "Add negative keywords to these accounts"
- "Update budget for Campaign X"
- "Create new ad group"
- "Remove this keyword"
- "Pause these campaigns"

---

## How to Use MutationGuard

### Step 1: Import the Guard

```python
from utils.mutation_guard import MutationGuard, MutationRequest, get_mutation_guard
```

### Step 2: Create a Mutation Request

```python
request = MutationRequest(
    operation_type="ADD_KEYWORDS",  # Descriptive name
    account_cid="1234567890",       # Customer ID
    account_name="Example Account", # Human-readable name
    description="Add 131 account-level negative keywords",  # What this does
    dry_run_preview={               # Data to show user
        "keywords_to_add": 131,
        "sample": ["competitor name", "irrelevant term"]
    }
)
```

### Step 3: Prepare Your Mutation Function

```python
def add_keywords_to_account(customer_id, keywords):
    """Your actual mutation logic here"""
    # ... Google Ads API calls ...
    return {"keywords_added": len(keywords), "status": "success"}
```

### Step 4: Execute Through Guard

```python
guard = get_mutation_guard()

# First call - generates preview and approval code
result = guard.execute(request, add_keywords_to_account, customer_id, keywords)

if result["status"] == "preview_generated":
    print(result["message"])  # Show preview to user
    # Agent STOPS HERE and waits for user input
```

### Step 5: Handle User Approval

When user responds with approval:

```python
# User says: "I approve APPROVE-20251028-143052, unlock and ready to post"
result = guard.verify_user_input(user_message)

if result["status"] == "awaiting_post":
    print(result["message"])  # Show confirmation, ask for POST NOW
    # Agent STOPS HERE and waits again
```

### Step 6: Handle POST NOW

When user says "POST NOW":

```python
# User says: "POST NOW"
result = guard.verify_user_input("POST NOW")

if result["status"] == "ready_to_execute":
    # NOW we can actually execute
    result = guard.execute(request, add_keywords_to_account, customer_id, keywords)

    if result["status"] == "completed":
        print(result["message"])  # Success!
        print(result["data"])     # Mutation result
```

---

## Complete Example

```python
from utils.mutation_guard import MutationGuard, MutationRequest

def main():
    # Step 1: Create request
    request = MutationRequest(
        operation_type="ADD_KEYWORDS",
        account_cid="1234567890",
        account_name="Example Account",
        description="Add 131 account-level negative keywords",
        dry_run_preview={
            "keywords_to_add": 131,
            "baseline_source": "Template Account",
            "sample_keywords": ["competitor", "irrelevant", "off-topic"]
        }
    )

    # Step 2: Define mutation function
    def perform_mutation(customer_id, keywords):
        # Your Google Ads API mutation code here
        # This only runs after TWO approvals
        shared_set_service.mutate_shared_criteria(...)
        return {"success": True, "keywords_added": len(keywords)}

    # Step 3: Execute through guard
    guard = MutationGuard()

    # Generate preview (STOPS HERE - waits for user)
    result = guard.execute(request, perform_mutation, customer_id, keywords)
    print(result["message"])

    # (User provides approval code + unlock phrase)
    approval_input = input("Your response: ")
    result = guard.verify_user_input(approval_input)
    print(result["message"])

    # (User says POST NOW)
    post_input = input("Your response: ")
    result = guard.verify_user_input(post_input)

    if result["status"] == "ready_to_execute":
        # Execute the actual mutation
        result = guard.execute(request, perform_mutation, customer_id, keywords)
        print(result["message"])
        print(result.get("data"))
```

---

## Agent Integration Pattern

For agents that make mutations, include this in agent instructions:

```markdown
## Mutation Safety Protocol

Before executing ANY mutations to Google Ads accounts:

1. **Import MutationGuard:**
   ```python
   from utils.mutation_guard import MutationGuard, MutationRequest
   ```

2. **Create MutationRequest** with operation details

3. **Execute through guard:**
   ```python
   guard = MutationGuard()
   result = guard.execute(request, mutation_function, *args)
   ```

4. **Output preview to user** and STOP

5. **Wait for user to provide approval code + unlock phrase**

6. **Verify with:** `guard.verify_user_input(user_message)`

7. **Wait for user to say "POST NOW"**

8. **Verify again:** `guard.verify_user_input("POST NOW")`

9. **Execute mutation:** `guard.execute(request, mutation_function, *args)`

10. **Log completion** (automatic)

**NEVER bypass this process.** All mutations MUST go through MutationGuard.
```

---

## Safety Guarantees

When using MutationGuard, you get:

- **Three-barrier protection:**
  1. User must provide correct approval code
  2. User must say "unlock and ready to post"
  3. User must say "POST NOW"

- **Automatic logging:**
  - All mutations logged to `logs/mutations_log.jsonl`
  - Human-readable summary in `logs/mutations_summary.txt`

- **Timeout protection:**
  - Sessions expire after 10 minutes of inactivity
  - Forces re-review if user gets distracted

- **Cancellation support:**
  - User can say "cancel" at any step
  - Safely aborts without making changes

- **State machine enforcement:**
  - Cannot skip steps
  - Cannot execute without approval

---

## Error Handling

### "No active mutation session"
**Cause:** Trying to verify input before creating a request

**Solution:** Call `guard.execute(request, func)` first

### "Session timed out"
**Cause:** More than 10 minutes elapsed

**Solution:** Re-run from beginning (generates new approval code)

### "Approval code not found"
**Cause:** User didn't include approval code in response

**Solution:** Ask user to include the exact code

### "Cannot post: Session not unlocked"
**Cause:** User said "POST NOW" before unlocking

**Solution:** User must provide approval code + unlock phrase first

---

## For Script Developers

When writing new scripts that mutate Google Ads accounts:

### DO:
- Import MutationGuard at the top
- Wrap ALL mutation operations in guard.execute()
- Show dry-run preview to user first
- Wait for explicit approval
- Check result status at each step
- Handle cancellation gracefully

### DON'T:
- Call Google Ads API mutation methods directly
- Skip the dry-run step
- Accept generic "yes" responses (require specific approval code)
- Execute mutations in a loop without confirmation each time
- Bypass the guard "just this once"

---

## Testing MutationGuard

To test the safety system:

```bash
python utils/mutation_guard.py
```

This runs a full test cycle showing:
- Preview generation
- Approval verification
- POST NOW confirmation
- Execution
- Logging

---

## Files in This Package

```
mutation-safety-skill/
├── SKILL.md                      # This file (Claude Code skill definition)
└── utils/
    ├── __init__.py               # Package exports
    ├── mutation_guard.py         # Google Ads mutation safety
    ├── mutation_logger.py        # Logging and audit trail
    └── sheets_write_guard.py     # Google Sheets write safety
```

---

## Integration Checklist

When creating a new agent/script that makes mutations:

### Safety System
- [ ] Import MutationGuard and MutationRequest
- [ ] Create MutationRequest with all required fields
- [ ] Define mutation function separately from guard logic
- [ ] Call guard.execute() to generate preview
- [ ] Output preview message to user
- [ ] STOP and wait for user input
- [ ] Call guard.verify_user_input() with user's response
- [ ] Handle "awaiting_post" status by waiting for POST NOW
- [ ] Call guard.verify_user_input() again for POST NOW
- [ ] Execute mutation through guard.execute()
- [ ] Handle result status (completed/error)
- [ ] Test entire flow before deploying

### Exact Match Requirements
- [ ] Default to exact match (`=`) - no flag needed
- [ ] Require `--pattern` flag to opt-in to partial matching
- [ ] Normalize CIDs (strip dashes) before comparison
- [ ] Show user exactly what will be modified in dry-run preview
- [ ] Verify identifier exists before attempting mutation

---

## Google Sheets Write Safety

### When Sheets Safety Applies

Sheets write safety is REQUIRED for:
- **OVERWRITE** - Clearing and replacing existing data
- **DELETE** - Removing tabs or data
- **CLEAR** - Emptying tab contents

Sheets write safety is NOT required for:
- **APPEND** - Adding rows to empty tabs
- **CREATE** - Creating new tabs
- **READ** - Reading data

### How to Use SheetsWriteGuard

```python
from utils.sheets_write_guard import SheetsWriteGuard, SheetsWriteRequest

# Create write request
request = SheetsWriteRequest(
    operation_type="CLEAR_SHEET",
    spreadsheet_id="YOUR_SPREADSHEET_ID",
    spreadsheet_name="Audit Results",
    sheet_name="Flagged Items",
    description="Clear data before refresh",
    dry_run_preview={
        "rows_affected": 500,
        "columns_affected": 10
    }
)

# Execute through guard
guard = SheetsWriteGuard()
result = guard.execute(request, write_callable, *args)
```

### Sheets Preview Format

```
======================================================================
SHEETS DRY-RUN PREVIEW - NO CHANGES WILL BE MADE
======================================================================

Operation: CLEAR_SHEET
Spreadsheet: Audit Results
Sheet/Tab: Flagged Items
Description: Clear data before refresh

Preview Details:
  rows_affected: 500
  columns_affected: 10

======================================================================
WARNING: This operation will modify/delete existing data!
======================================================================

To proceed, respond with:
  "I approve SHEETS-20251125-143052, unlock and ready to post"

(Or say 'cancel' to abort)
======================================================================
```

### Approval Codes

- **Google Ads mutations:** `APPROVE-YYYYMMDD-HHMMSS`
- **Google Sheets writes:** `SHEETS-YYYYMMDD-HHMMSS`

---

## Logging to Google Sheets (Optional)

For additional audit trail, you can log mutations to a central Google Sheet:

### Required Columns

| Column | Description | Example |
|--------|-------------|---------|
| Timestamp | UTC ISO timestamp | `2026-01-21T20:58:32.123456` |
| Account | Account name | `Example Account` |
| CID | Customer ID (no dashes) | `1234567890` |
| Action Type | Operation type | `ADD_KEYWORDS`, `PAUSE_CAMPAIGNS` |
| Details Summary | What changed | `Updated 7 conversion values` |
| Success | YES or NO | `YES` |
| Error | Error message if failed | `` (empty if success) |
| Approval Code | The approval code used | `APPROVE-20260121-143052` |

### Action Type Standards

Use consistent action types across all mutations:

| Action Type | Use For |
|-------------|---------|
| `UPDATE_CONVERSION_VALUES` | Changing conversion action values |
| `ADD_KEYWORDS` | Adding negative or positive keywords |
| `PAUSE_CAMPAIGNS` | Pausing campaigns |
| `ENABLE_CAMPAIGNS` | Enabling campaigns |
| `UPDATE_BUDGETS` | Changing campaign budgets |
| `CREATE_CONVERSION` | Creating new conversion actions |
| `RENAME_CONVERSION` | Renaming conversion actions |
| `UPDATE_TARGETING` | Changing location/audience targeting |
| `UPDATE_ASSETS` | Modifying ad assets |

---

## Related Documentation

- `utils/mutation_guard.py` - Google Ads mutation safety
- `utils/sheets_write_guard.py` - Google Sheets write safety
- `utils/mutation_logger.py` - Logging system

---

**Version:** 1.2
**Status:** MANDATORY - All mutations and destructive Sheets writes must use this system
**Enforcement:** Auto-invoked by Claude for any mutation or destructive Sheets operation
