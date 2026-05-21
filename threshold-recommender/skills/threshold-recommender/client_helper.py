"""
client_helper.py – Shared client path resolution for brain scripts.

Usage:
    from client_helper import get_client, get_paths

    client = get_client("mondoffice")   # reads accounts.json
    paths  = get_paths(client)          # returns data/reports dirs
"""

import json
import os
import sys
from pathlib import Path

BRAIN_ROOT = Path(__file__).parent.parent
ACCOUNTS_PATH = BRAIN_ROOT / ".claude" / "accounts.json"
CSS_PATH = BRAIN_ROOT / "data" / "Report-GoogleAds" / "template.css"


def load_accounts():
    if not ACCOUNTS_PATH.exists():
        raise FileNotFoundError(f"accounts.json not found at {ACCOUNTS_PATH}")
    with open(ACCOUNTS_PATH) as f:
        return json.load(f)


def find_account(alias):
    """Find account by key, alias, name, or ID."""
    accounts = load_accounts()
    alias_lower = alias.lower()
    for key, acc in accounts.items():
        if key.lower() == alias_lower:
            return key, acc
        if acc.get("id") == alias:
            return key, acc
        if acc.get("name", "").lower() == alias_lower:
            return key, acc
        for a in acc.get("aliases", []):
            if a.lower() == alias_lower:
                return key, acc
    raise ValueError(f"Account '{alias}' not found in accounts.json.\n"
                     f"Available: {', '.join(accounts.keys())}")


def get_client(alias=None):
    """
    Load client config from accounts.json.
    If alias is None, reads from sys.argv[1].
    Returns dict with all account fields + resolved folder key.
    """
    if alias is None:
        if len(sys.argv) < 2:
            accounts = load_accounts()
            print("Usage: python3 <script>.py <client-alias>")
            print(f"Available: {', '.join(accounts.keys())}")
            sys.exit(1)
        alias = sys.argv[1]

    key, acc = find_account(alias)
    return {"_key": key, **acc}


def get_paths(client):
    """
    Return resolved paths for a client.
    Creates data/ and reports/ folders if they don't exist.
    """
    key = client["_key"]
    base = BRAIN_ROOT / "clients" / key
    data_dir    = base / "data"
    reports_dir = base / "reports"
    data_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)
    return {
        "base":    base,
        "data":    data_dir,
        "reports": reports_dir,
        "css":     CSS_PATH,
    }


def load_css():
    with open(CSS_PATH) as f:
        return f.read()


# ── PMAX Brand Exclusion Check ────────────────────────────────────────────────

def check_pmax_brand_exclusions(svc, customer_id, login_customer_id, brand_strings):
    """
    Check whether PMAX campaigns have brand negative keywords configured.

    Args:
        svc:               GoogleAdsService instance (already authenticated)
        customer_id:       str – Google Ads customer ID
        login_customer_id: str – MCC ID (or same as customer_id if direct)
        brand_strings:     list[str] – brand terms to check (from accounts.json)

    Returns:
        dict with keys:
          campaigns     – list of PMAX campaign dicts
          gap_analysis  – list of per-campaign gap dicts
          has_gap       – bool: True if any active campaign is missing brand negatives
          brand_terms   – the terms that were checked
    """
    from google.ads.googleads.errors import GoogleAdsException

    def q(query):
        try:
            return list(svc.search(customer_id=customer_id, query=query))
        except GoogleAdsException as ex:
            return []

    def m2c(v): return float(v) / 1_000_000
    def _roas(val, cost): return round(float(val) / float(cost), 2) if float(cost) > 0 else 0

    # Canonical brand terms to check (all lowercase)
    BRAND_TERMS = list({b.lower() for b in brand_strings})

    # 1. PMAX campaigns with 2025 spend
    camp_rows = q("""
        SELECT campaign.id, campaign.name, campaign.status,
               metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.conversions_value
        FROM campaign
        WHERE campaign.advertising_channel_type IN ('PERFORMANCE_MAX')
          AND campaign.status != 'REMOVED'
          AND segments.date BETWEEN '2025-01-01' AND '2025-12-31'
        ORDER BY metrics.cost_micros DESC
    """)
    campaigns = []
    for r in camp_rows:
        cost = m2c(r.metrics.cost_micros)
        campaigns.append({
            "id":          r.campaign.id,
            "name":        r.campaign.name,
            "status":      r.campaign.status.name,
            "cost":        cost,
            "clicks":      r.metrics.clicks,
            "conversions": r.metrics.conversions,
            "conv_value":  r.metrics.conversions_value,
            "roas":        _roas(r.metrics.conversions_value, cost),
        })

    # 2. Shared negative keyword lists applied to each campaign
    shared_lists = {}
    for c in campaigns:
        rows = q(f"""
            SELECT campaign.id, shared_set.name, shared_set.type
            FROM campaign_shared_set
            WHERE campaign.id = {c['id']}
        """)
        shared_lists[c["id"]] = [
            {"name": r.shared_set.name, "type": r.shared_set.type.name}
            for r in rows
        ]

    # 3. Campaign-level negative keywords
    camp_negatives = {}
    for c in campaigns:
        rows = q(f"""
            SELECT campaign_criterion.keyword.text,
                   campaign_criterion.keyword.match_type
            FROM campaign_criterion
            WHERE campaign.id = {c['id']}
              AND campaign_criterion.type = 'KEYWORD'
              AND campaign_criterion.negative = TRUE
        """)
        camp_negatives[c["id"]] = [
            {"text":  r.campaign_criterion.keyword.text.lower(),
             "match": r.campaign_criterion.keyword.match_type.name}
            for r in rows
        ]

    # 4. Gap analysis per campaign
    def _has_coverage(negatives, brand_term):
        bt = brand_term.lower()
        for neg in negatives:
            nt = neg["text"]
            if neg["match"] == "EXACT" and nt == bt:
                return True
            if neg["match"] in ("PHRASE", "BROAD") and nt in bt:
                return True
        return False

    gap_analysis = []
    for c in campaigns:
        negs = camp_negatives.get(c["id"], [])
        gaps    = [bt for bt in BRAND_TERMS if not _has_coverage(negs, bt)]
        covered = [bt for bt in BRAND_TERMS if _has_coverage(negs, bt)]
        gap_analysis.append({
            "campaign":    c,
            "gaps":        gaps,
            "covered":     covered,
            "negatives":   camp_negatives.get(c["id"], []),
            "shared_lists": shared_lists.get(c["id"], []),
        })

    active_gaps = [
        g for ga in gap_analysis
        for g in ga["gaps"]
        if ga["campaign"]["status"] == "ENABLED"
    ]

    return {
        "campaigns":    campaigns,
        "gap_analysis": gap_analysis,
        "has_gap":      len(active_gaps) > 0,
        "brand_terms":  BRAND_TERMS,
    }
