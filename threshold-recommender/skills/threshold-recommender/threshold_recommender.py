#!/usr/bin/env python3
"""
Shopping Threshold Recommender — Interactive Edition

Pulls product-level Shopping data, embeds it as JSON in an interactive HTML app.
Sliders let you adjust ROAS threshold and click threshold in real-time,
with a 4-quadrant bucketing chart (like Mike Rhodes' tool).

Statistical recommendation panel explains the right thresholds for the account.

Usage: python3 threshold_recommender.py <client-alias>
"""

import json
import math
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

sys.path.insert(0, str(Path(__file__).parent))
from client_helper import get_client, get_paths, load_css


LOOKBACK_WEEKS = 8
CONFIDENCE_LEVEL = 0.95


def setup_client(client_cfg):
    ads_client = GoogleAdsClient.load_from_storage(
        path=os.path.expanduser("~/google-ads.yaml"),
        version="v23"
    )
    ads_client.login_customer_id = client_cfg.get(
        "login_customer_id", client_cfg["id"]
    )
    return ads_client


def run_query(service, customer_id, query):
    try:
        return list(service.search(customer_id=customer_id, query=query))
    except GoogleAdsException as ex:
        print(f"  ERROR: {ex.error.code().name}")
        for e in ex.failure.errors:
            print(f"    {e.message}")
        return []


def min_clicks_for_unprofitable(avg_cr, confidence=0.95):
    if avg_cr <= 0:
        return 999
    return math.ceil(math.log(1 - confidence) / math.log(1 - avg_cr))


def min_clicks_for_bestseller(avg_cr, multiplier=2.0, confidence=0.95):
    if avg_cr <= 0:
        return 999
    z = 1.96 if confidence == 0.95 else 1.645
    target_cr = avg_cr * multiplier
    margin = target_cr - avg_cr
    if margin <= 0:
        return 999
    n = z**2 * target_cr * (1 - target_cr) / margin**2
    return max(math.ceil(n), 10)


def main():
    client_cfg = get_client()
    paths = get_paths(client_cfg)

    CUSTOMER_ID = client_cfg["id"]
    CURRENCY = client_cfg.get("currency", "EUR")
    CURRENCY_SYMBOL = {"EUR": "\u20ac", "USD": "$", "GBP": "\u00a3", "DKK": "kr"}.get(CURRENCY, CURRENCY)
    CLIENT_NAME = client_cfg.get("name", client_cfg["_key"])

    ads_client = setup_client(client_cfg)
    ga_service = ads_client.get_service("GoogleAdsService")

    end_date = datetime.now()
    start_date = end_date - timedelta(weeks=LOOKBACK_WEEKS)

    print(f"\n{'='*60}")
    print(f"  Threshold Recommender: {CLIENT_NAME}")
    print(f"  Period: {start_date.strftime('%Y-%m-%d')} -> {end_date.strftime('%Y-%m-%d')}")
    print(f"{'='*60}\n")

    # ── Pull data ────────────────────────────────────────────────────────

    print("Pulling Shopping product data...")

    query = f"""
        SELECT
            campaign.name,
            segments.product_item_id,
            segments.product_title,
            segments.product_type_l1,
            segments.product_type_l2,
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM shopping_performance_view
        WHERE segments.date BETWEEN '{start_date.strftime("%Y-%m-%d")}'
          AND '{end_date.strftime("%Y-%m-%d")}'
    """

    rows = run_query(ga_service, CUSTOMER_ID, query)
    print(f"  -> {len(rows)} rows returned")

    if not rows:
        print("\nNo Shopping data found.")
        sys.exit(1)

    # ── Aggregate by product and campaign ────────────────────────────────

    products = defaultdict(lambda: {
        "title": "", "cat1": "", "cat2": "",
        "clicks": 0, "impr": 0, "cost": 0.0,
        "conv": 0.0, "value": 0.0
    })
    campaigns = defaultdict(lambda: {
        "clicks": 0, "impr": 0, "cost": 0.0, "conv": 0.0, "value": 0.0, "products": set()
    })

    for r in rows:
        pid = r.segments.product_item_id or "(unknown)"
        products[pid]["title"] = (r.segments.product_title or pid)[:80]
        products[pid]["cat1"] = r.segments.product_type_l1 or "(none)"
        products[pid]["cat2"] = r.segments.product_type_l2 or ""
        products[pid]["clicks"] += r.metrics.clicks
        products[pid]["impr"] += r.metrics.impressions
        products[pid]["cost"] += r.metrics.cost_micros / 1_000_000
        products[pid]["conv"] += r.metrics.conversions
        products[pid]["value"] += r.metrics.conversions_value

        cname = r.campaign.name or "(unknown)"
        campaigns[cname]["clicks"] += r.metrics.clicks
        campaigns[cname]["impr"] += r.metrics.impressions
        campaigns[cname]["cost"] += r.metrics.cost_micros / 1_000_000
        campaigns[cname]["conv"] += r.metrics.conversions
        campaigns[cname]["value"] += r.metrics.conversions_value
        campaigns[cname]["products"].add(r.segments.product_item_id or "(unknown)")

    # Build compact JSON array for the HTML — minimal fields only
    # Category mapping: assign index to save space
    cat_names = sorted(set(p["cat1"] for p in products.values()))
    cat_index = {c: i for i, c in enumerate(cat_names)}

    product_list = []
    for pid, p in products.items():
        roas = round(p["value"] / p["cost"], 1) if p["cost"] > 0 else 0
        cr = round(p["conv"] / p["clicks"] * 100, 2) if p["clicks"] > 0 else 0
        product_list.append([
            cat_index.get(p["cat1"], 0),  # 0: category index
            p["clicks"],                   # 1: clicks
            p["impr"],                     # 2: impressions
            round(p["cost"], 1),           # 3: cost
            round(p["conv"], 1),           # 4: conversions
            round(p["value"], 1),          # 5: revenue
            roas,                          # 6: roas
            cr,                            # 7: cr
        ])

    campaign_list = sorted([
        [
            cname,
            len(c["products"]),      # 1: unique products
            c["clicks"],             # 2: clicks
            c["impr"],               # 3: impressions
            round(c["cost"], 1),     # 4: cost
            round(c["conv"], 1),     # 5: conv
            round(c["value"], 1),    # 6: revenue
            round(c["value"] / c["cost"], 1) if c["cost"] > 0 else 0,  # 7: roas
        ]
        for cname, c in campaigns.items()
    ], key=lambda x: x[4], reverse=True)  # sort by cost desc

    total_clicks = sum(p[1] for p in product_list)
    total_conv = sum(p[4] for p in product_list)
    total_cost = sum(p[3] for p in product_list)
    total_rev = sum(p[5] for p in product_list)
    total_products = len(product_list)
    avg_cr = total_conv / total_clicks if total_clicks > 0 else 0
    avg_roas = total_rev / total_cost if total_cost > 0 else 0

    min_unprof = min_clicks_for_unprofitable(avg_cr)
    min_best = min_clicks_for_bestseller(avg_cr)

    print(f"  Products: {total_products:,}")
    print(f"  Avg CR:   {avg_cr*100:.2f}%")
    print(f"  Avg ROAS: {avg_roas:.1f}x")
    print(f"  Stat min unprofitable: {min_unprof} clicks")
    print(f"  Stat min bestseller:   {min_best} clicks")

    # ── Account stats for JS ─────────────────────────────────────────────

    account_stats = {
        "name": CLIENT_NAME,
        "currency": CURRENCY_SYMBOL,
        "weeks": LOOKBACK_WEEKS,
        "startDate": start_date.strftime("%d %b %Y"),
        "endDate": end_date.strftime("%d %b %Y"),
        "totalProducts": total_products,
        "totalClicks": total_clicks,
        "totalConv": round(total_conv, 1),
        "totalCost": round(total_cost, 0),
        "totalRev": round(total_rev, 0),
        "avgCr": round(avg_cr * 100, 2),
        "avgRoas": round(avg_roas, 1),
        "avgCpa": round(total_cost / total_conv, 2) if total_conv > 0 else 0,
        "recClickThreshold": min_unprof,
        "recBestThreshold": min_best,
        "cats": cat_names,
    }

    # ── Generate HTML ────────────────────────────────────────────────────

    print("Generating interactive HTML...")

    products_json = json.dumps(product_list, separators=(',', ':'))
    stats_json = json.dumps(account_stats, separators=(',', ':'))
    campaigns_json = json.dumps(campaign_list, separators=(',', ':'))

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Threshold Recommender — {CLIENT_NAME}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {{
    --ink: #1C1C1C;
    --ink-light: #464F55;
    --ink-muted: #6C757D;
    --paper: #FCFCFC;
    --paper-warm: #F0F2F2;
    --accent: #3AC3D2;
    --accent-dark: #2BA3B0;
    --accent-light: #EBF9FA;
    --border: #DDE1E5;
    --success: #1a7f37;
    --success-bg: #dafbe1;
    --warning: #d4a017;
    --warning-bg: #fff8e1;
    --danger: #cf222e;
    --danger-bg: #ffebe9;

    /* Quadrant colors */
    --q-profitable: #dafbe1;
    --q-costly: #ffebe9;
    --q-flukes: #fff8e1;
    --q-meh: #e8e0f0;
}}

* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
    font-family: 'Roboto', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink);
    background: #f5f6f8;
    min-height: 100vh;
}}

/* ── Header ──────────────────────────────────────────── */
.header {{
    background: var(--ink);
    color: white;
    padding: 20px 32px;
}}
.header h1 {{
    font-family: 'Poppins', sans-serif;
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 2px;
}}
.header .subtitle {{
    font-size: 13px;
    color: rgba(255,255,255,0.6);
}}

/* ── KPI Strip ───────────────────────────────────────── */
.kpi-strip {{
    display: flex;
    gap: 1px;
    background: var(--border);
    border-bottom: 1px solid var(--border);
}}
.kpi {{
    flex: 1;
    background: white;
    padding: 14px 20px;
    text-align: center;
}}
.kpi .val {{
    font-family: 'Poppins', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
}}
.kpi .lbl {{
    font-size: 11px;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
}}

/* ── Main Layout ─────────────────────────────────────── */
.container {{
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 24px;
}}

/* ── Controls Panel ──────────────────────────────────── */
.panel {{
    background: white;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}}
.panel h2 {{
    font-family: 'Poppins', sans-serif;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}}
.panel h2 .icon {{ font-size: 18px; }}

/* Toggle switch */
.toggle-row {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    font-size: 13px;
    font-weight: 500;
}}
.toggle {{
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--accent);
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
}}
.toggle.off {{ background: var(--ink-muted); }}
.toggle::after {{
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
}}
.toggle.off::after {{ transform: translateX(20px); }}

/* Slider group */
.slider-group {{
    margin-bottom: 24px;
}}
.slider-label {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-light);
}}
.slider-value {{
    font-family: 'Poppins', sans-serif;
    font-weight: 700;
    font-size: 15px;
    color: var(--ink);
    background: var(--accent-light);
    padding: 2px 10px;
    border-radius: 6px;
}}
.slider-value.green {{ background: var(--success-bg); color: var(--success); }}
input[type=range] {{
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--paper-warm);
    outline: none;
    margin: 8px 0;
}}
input[type=range]::-webkit-slider-thumb {{
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}}
input[type=range].green::-webkit-slider-thumb {{
    background: var(--success);
}}
.slider-range {{
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--ink-muted);
    margin-top: -2px;
}}

/* Recommended badge */
.rec-badge {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-dark);
    background: var(--accent-light);
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
}}
.rec-badge:hover {{
    border-color: var(--accent);
    background: white;
}}

/* Divider */
.divider {{
    height: 1px;
    background: var(--border);
    margin: 20px 0;
}}

/* ── Quadrant Chart ──────────────────────────────────── */
.chart-area {{
    display: flex;
    flex-direction: column;
    gap: 24px;
}}
.quadrant-container {{
    background: white;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}}
.quadrant-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}}
.quadrant-header h2 {{
    font-family: 'Poppins', sans-serif;
    font-size: 15px;
    font-weight: 600;
}}
.quadrant-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 3px;
    height: 360px;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
}}
.quadrant {{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    position: relative;
    transition: all 0.3s;
}}
.quadrant .q-label {{
    font-family: 'Poppins', sans-serif;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
}}
.quadrant .q-count {{
    font-family: 'Poppins', sans-serif;
    font-size: 42px;
    font-weight: 700;
    line-height: 1;
}}
.quadrant .q-detail {{
    font-size: 12px;
    margin-top: 6px;
    opacity: 0.7;
}}

.q-costly {{ background: var(--q-costly); }}
.q-costly .q-label {{ color: var(--danger); }}
.q-costly .q-count {{ color: var(--danger); }}

.q-profitable {{ background: var(--q-profitable); }}
.q-profitable .q-label {{ color: var(--success); }}
.q-profitable .q-count {{ color: var(--success); }}

.q-meh {{ background: var(--q-meh); }}
.q-meh .q-label {{ color: #6b46a0; }}
.q-meh .q-count {{ color: #6b46a0; }}

.q-flukes {{ background: var(--q-flukes); }}
.q-flukes .q-label {{ color: #b8860b; }}
.q-flukes .q-count {{ color: #b8860b; }}

/* Axis labels on quadrant */
.axis-x, .axis-y {{
    position: absolute;
    font-family: 'Poppins', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}}
.axis-x {{
    bottom: -22px;
    left: 50%;
    transform: translateX(-50%);
}}
.axis-y {{
    left: -22px;
    top: 50%;
    transform: translateY(-50%) rotate(-90deg);
    white-space: nowrap;
}}

/* Threshold lines */
.threshold-line-v {{
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(58, 195, 210, 0.5);
    border-left: 2px dashed var(--accent-dark);
    z-index: 2;
    pointer-events: none;
}}
.threshold-line-h {{
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(26, 127, 55, 0.3);
    border-top: 2px dashed var(--success);
    z-index: 2;
    pointer-events: none;
}}

/* Bottom stats */
.bottom-stats {{
    display: flex;
    gap: 12px;
    margin-top: 16px;
    justify-content: center;
}}
.bottom-stat {{
    font-size: 13px;
    padding: 6px 14px;
    border-radius: 6px;
    background: var(--paper-warm);
    font-weight: 500;
}}
.bottom-stat strong {{
    font-family: 'Poppins', sans-serif;
}}

/* ── Recommendation Panel ────────────────────────────── */
.rec-panel {{
    background: white;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}}
.rec-panel h2 {{
    font-family: 'Poppins', sans-serif;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 16px;
}}
.rec-card {{
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 12px;
    border-left: 4px solid;
}}
.rec-card h3 {{
    font-family: 'Poppins', sans-serif;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
}}
.rec-card p {{
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-light);
}}
.rec-card.info {{ background: var(--accent-light); border-color: var(--accent); }}
.rec-card.warn {{ background: var(--warning-bg); border-color: var(--warning); }}
.rec-card.good {{ background: var(--success-bg); border-color: var(--success); }}
.rec-card.bad  {{ background: var(--danger-bg); border-color: var(--danger); }}

.formula {{
    font-family: 'Roboto Mono', monospace;
    font-size: 12px;
    background: var(--paper-warm);
    padding: 8px 12px;
    border-radius: 6px;
    margin: 8px 0;
    border: 1px solid var(--border);
}}

/* ── Category table ──────────────────────────────────── */
.cat-table-wrap {{
    background: white;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    overflow-x: auto;
}}
.cat-table-wrap h2 {{
    font-family: 'Poppins', sans-serif;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
}}
table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}}
thead {{ background: var(--ink); color: white; }}
th {{
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    text-align: left;
    padding: 10px 12px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}}
td {{
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
}}
tbody tr:hover {{ background: var(--paper-warm); }}
.num {{ text-align: right; font-variant-numeric: tabular-nums; }}

/* ── Bucket Summary Table ────────────────────────────── */
.bucket-summary-wrap {{
    background: white;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    overflow-x: auto;
}}
.bucket-summary-wrap h2 {{
    font-family: 'Poppins', sans-serif;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
}}
.bucket-summary-wrap table thead {{
    background: transparent;
}}
.bucket-summary-wrap table th {{
    text-transform: none;
    letter-spacing: 0;
    font-size: 12px;
    border-radius: 4px;
    padding: 8px 12px;
}}
.bh-profitable {{ background: var(--success-bg); color: var(--success); }}
.bh-flukes {{ background: var(--warning-bg); color: #b8860b; }}
.bh-costly {{ background: var(--danger-bg); color: var(--danger); }}
.bh-meh {{ background: var(--q-meh); color: #6b46a0; }}
.bh-zombies {{ background: var(--paper-warm); color: var(--ink-muted); }}
.bh-zeroconv {{ background: #fff3e0; color: #e65100; }}
.bh-costlywaste {{ background: #fce4ec; color: #b71c1c; }}

/* ── Axis Legend ─────────────────────────────────────── */
.axis-legend-row {{
    display: flex;
    justify-content: space-around;
    align-items: center;
    margin-top: 10px;
    padding: 8px 16px;
    background: var(--paper-warm);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-light);
    gap: 16px;
}}
.axis-legend-row span {{
    white-space: nowrap;
}}

/* ── Footer ──────────────────────────────────────────── */
.page-footer {{
    text-align: center;
    padding: 20px;
    font-size: 12px;
    color: var(--ink-muted);
}}
</style>
</head>
<body>

<div class="header">
    <h1>Shopping Threshold Recommender</h1>
    <div class="subtitle">{CLIENT_NAME} &mdash; {LOOKBACK_WEEKS}-week analysis ({start_date.strftime('%d %b')} &rarr; {end_date.strftime('%d %b %Y')})</div>
</div>

<div class="kpi-strip" id="kpiStrip"></div>

<div class="container">
    <!-- Left: Controls -->
    <div>
        <div class="panel">
            <h2><span class="icon">&#9881;</span> Bucketing Controls</h2>

            <div class="toggle-row">
                <span>ROAS</span>
                <div class="toggle" id="metricToggle" onclick="toggleMetric()"></div>
                <span>CPA</span>
            </div>

            <div class="slider-group">
                <div class="slider-label">
                    <span id="profitLabel">ROAS Threshold</span>
                    <span class="slider-value green" id="profitValue"></span>
                </div>
                <input type="range" id="profitSlider" class="green" min="0.5" max="100" step="0.1" value="3">
                <div class="slider-range">
                    <span id="profitMin">0.5x</span>
                    <span id="profitMax">—</span>
                </div>
                <div style="margin-top:6px">
                    <span class="rec-badge" onclick="setRecommendedProfit()" id="recProfitBadge"></span>
                </div>
            </div>

            <div class="toggle-row">
                <span style="color:var(--accent); font-weight:600">Cost</span>
                <div class="toggle" id="volumeToggle" onclick="toggleVolume()"></div>
                <span>Clicks</span>
            </div>

            <div class="slider-group">
                <div class="slider-label">
                    <span id="volumeLabel">Cost Threshold</span>
                    <span class="slider-value" id="volumeValue"></span>
                </div>
                <input type="range" id="volumeSlider" min="1" max="500" step="1" value="20">
                <div class="slider-range">
                    <span id="volumeMin">1</span>
                    <span id="volumeMax">500</span>
                </div>
                <div style="margin-top:6px">
                    <span class="rec-badge" onclick="setRecommendedVolume()" id="recVolumeBadge"></span>
                </div>
            </div>

            <div style="margin-top:16px;border-radius:10px;border:1px solid var(--border);overflow:hidden;">
                <div style="background:var(--accent-light);border-bottom:1px solid var(--border);padding:10px 14px;display:flex;align-items:center;gap:8px;">
                    <span style="font-size:15px;">&#128161;</span>
                    <span style="font-family:'Poppins',sans-serif;font-size:12px;font-weight:600;color:var(--ink);">Spend-Based Threshold</span>
                </div>
                <div style="padding:14px;background:white;">
                    <p style="font-size:11px;color:var(--ink-muted);line-height:1.6;margin:0 0 10px;">
                        A product that spent <strong>Target&nbsp;CPA&nbsp;&times;&nbsp;multiplier</strong> with
                        0 conversions has already &ldquo;paid&rdquo; for a sale that never happened.
                        No statistics needed &mdash; pure economic logic.
                    </p>
                    <div style="background:var(--paper-warm);border-radius:7px;padding:9px 12px;margin-bottom:14px;font-size:11px;line-height:1.7;color:var(--ink-muted);">
                        <span style="font-weight:700;color:var(--ink);">Example:</span>
                        Target CPA = &euro;30, multiplier = 2&times; &rarr; threshold = <strong>&euro;60</strong>.<br>
                        A garden hose spent &euro;63 with 0 sales &rarr; <span style="color:var(--danger);font-weight:600;">Costly</span>.
                        A BBQ grill spent &euro;41 with 0 sales &rarr; still <span style="color:var(--ink-muted);font-weight:600;">Meh</span> (below threshold, more data needed).
                    </div>
                    <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
                        <div style="flex:1;min-width:90px;">
                            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-muted);margin-bottom:6px;">Target CPA</div>
                            <div style="display:flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:7px;padding:5px 9px;background:var(--paper-warm);">
                                <span style="font-size:13px;color:var(--ink-muted);font-weight:600;" id="spendCurrencySymbol"></span>
                                <input type="number" id="targetCpaInput" min="1" step="1"
                                    style="width:56px;border:none;background:transparent;font-size:15px;font-weight:700;font-family:inherit;color:var(--ink);outline:none;">
                            </div>
                        </div>
                        <div style="flex:1;min-width:90px;">
                            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-muted);margin-bottom:6px;">Multiplier</div>
                            <div style="display:flex;gap:3px;" id="multiplierBtns">
                                <button onclick="setMultiplier(1.5,this)" style="flex:1;padding:6px 2px;border:1px solid var(--border);border-radius:6px;background:white;font-size:11px;font-weight:500;font-family:inherit;color:var(--ink-muted);cursor:pointer;">1.5&times;</button>
                                <button onclick="setMultiplier(2,this)"   style="flex:1;padding:6px 2px;border:1px solid var(--accent);border-radius:6px;background:var(--accent);font-size:11px;font-weight:700;font-family:inherit;color:white;cursor:pointer;">2&times;</button>
                                <button onclick="setMultiplier(2.5,this)" style="flex:1;padding:6px 2px;border:1px solid var(--border);border-radius:6px;background:white;font-size:11px;font-weight:500;font-family:inherit;color:var(--ink-muted);cursor:pointer;">2.5&times;</button>
                                <button onclick="setMultiplier(3,this)"   style="flex:1;padding:6px 2px;border:1px solid var(--border);border-radius:6px;background:white;font-size:11px;font-weight:500;font-family:inherit;color:var(--ink-muted);cursor:pointer;">3&times;</button>
                            </div>
                            <div style="position:relative;display:inline-block;margin-top:6px;">
                                <span id="multHintTrigger" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1px solid var(--border);font-size:10px;font-weight:700;color:var(--ink-muted);cursor:default;user-select:none;">?</span>
                                <div id="multHintBox" style="display:none;position:absolute;left:22px;bottom:-2px;width:240px;background:var(--ink);color:white;border-radius:8px;padding:10px 12px;font-size:11px;line-height:1.6;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.2);">
                                    <div style="font-weight:700;margin-bottom:6px;color:var(--accent-light);">How conservative do you want to be?</div>
                                    <div style="margin-bottom:4px;"><span style="color:var(--accent);">1.5&times;</span> &mdash; Fast decisions. Some false positives: a few decent products may get flagged too soon.</div>
                                    <div style="margin-bottom:4px;"><span style="color:var(--accent);">2&times;</span> &mdash; Balanced (recommended). Product paid for a full conversion that never came.</div>
                                    <div style="margin-bottom:4px;"><span style="color:var(--accent);">2.5&times;</span> &mdash; Conservative. High confidence before excluding.</div>
                                    <div><span style="color:var(--accent);">3&times;</span> &mdash; Very conservative. Nearly certain before acting &mdash; good for high-ticket items.</div>
                                    <div style="position:absolute;left:-5px;bottom:8px;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:5px solid var(--ink);"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="background:var(--accent-light);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-size:11px;color:var(--ink-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">Cost threshold</span>
                        <span style="font-size:20px;font-weight:700;color:var(--accent-dark);" id="spendThresholdDisplay">&mdash;</span>
                    </div>
                    <button onclick="applySpendThreshold()"
                        style="width:100%;padding:9px;background:var(--accent);color:white;border:none;border-radius:7px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;letter-spacing:0.3px;transition:background 0.15s;"
                        onmouseover="this.style.background='var(--accent-dark)'" onmouseout="this.style.background='var(--accent)'">
                        Apply to volume slider &#8595;
                    </button>
                </div>
            </div>

            <div class="divider"></div>

            <div id="currentVerdict" style="font-size:13px; color:var(--ink-light); line-height:1.6;"></div>
        </div>

        <!-- Recommendation Panel -->
        <div class="panel" style="margin-top:24px;">
            <h2>&#127919; AI Recommendation</h2>
            <div id="recPanel"></div>
        </div>
    </div>

    <!-- Right: Chart + Table -->
    <div class="chart-area">
        <div class="quadrant-container">
            <div class="quadrant-header">
                <h2>Product Bucketing</h2>
                <div id="totalLabel" style="font-size:12px; color:var(--ink-muted);"></div>
            </div>
            <div class="quadrant-grid" id="quadrant">
                <div class="quadrant q-costly" id="qCostly">
                    <div class="q-label">Costly</div>
                    <div class="q-count" id="cCostly">0</div>
                    <div class="q-detail" id="dCostly"></div>
                </div>
                <div class="quadrant q-profitable" id="qProfitable">
                    <div class="q-label">Profitable</div>
                    <div class="q-count" id="cProfitable">0</div>
                    <div class="q-detail" id="dProfitable"></div>
                </div>
                <div class="quadrant q-meh" id="qMeh">
                    <div class="q-label">Meh</div>
                    <div class="q-count" id="cMeh">0</div>
                    <div class="q-detail" id="dMeh"></div>
                </div>
                <div class="quadrant q-flukes" id="qFlukes">
                    <div class="q-label">Flukes</div>
                    <div class="q-count" id="cFlukes">0</div>
                    <div class="q-detail" id="dFlukes"></div>
                </div>
            </div>
            <div class="axis-legend-row" id="axisLegend">
                <span>&#x2194; X: Cost &ge; &mdash;</span>
                <span>&#x2195; Y: ROAS &ge; &mdash;</span>
            </div>
            <div class="bottom-stats" id="bottomStats"></div>
            <div id="zombieCatDetail" style="margin-top:10px;"></div>
        </div>

        <!-- Bucket Summary -->
        <div class="bucket-summary-wrap">
            <h2>Bucket Summary</h2>
            <div id="bucketSummary"></div>
        </div>

        <!-- Campaign breakdown -->
        <div class="cat-table-wrap">
            <h2>Campaign Breakdown <span id="campCount" style="font-weight:400; font-size:13px; color:var(--ink-muted);"></span></h2>
            <table>
                <thead><tr>
                    <th>Campaign</th>
                    <th class="num">Products</th>
                    <th class="num">Clicks</th>
                    <th class="num">Cost</th>
                    <th class="num">Conv</th>
                    <th class="num">Revenue</th>
                    <th class="num">ROAS</th>
                    <th class="num">CPA</th>
                </tr></thead>
                <tbody id="campBody"></tbody>
            </table>
        </div>

        <!-- Category breakdown -->
        <div class="cat-table-wrap">
            <h2>Category Breakdown</h2>
            <table>
                <thead><tr>
                    <th>Category</th>
                    <th class="num">Products</th>
                    <th class="num">Clicks</th>
                    <th class="num">Cost</th>
                    <th class="num">Conv</th>
                    <th class="num">ROAS</th>
                    <th class="num">Bestsellers</th>
                    <th class="num">Unprofitable</th>
                </tr></thead>
                <tbody id="catBody"></tbody>
            </table>
        </div>
    </div>
</div>

<div class="page-footer">
    Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} &mdash; Shopping Threshold Recommender
</div>

<script>
// ── Embedded Data ───────────────────────────────────────
// Product arrays: [catIdx, clicks, impr, cost, conv, revenue, roas, cr]
const P = {products_json};
const STATS = {stats_json};
const CATS = STATS.cats;
// Campaign arrays: [name, clicks, impr, cost, conv, revenue, roas]
const CAMPS = {campaigns_json};

// ── State ───────────────────────────────────────────────
let useRoas = true;     // false = CPA
let useCost = true;     // false = Clicks
let profitThreshold = STATS.avgRoas;  // start at avg ROAS, not hardcoded 3x
let volumeThreshold = 20;
let spendMultiplier = 2.0;

// ── Init ────────────────────────────────────────────────
function init() {{
    // Set KPI strip
    const ks = document.getElementById('kpiStrip');
    ks.innerHTML = [
        kpi(fmt(STATS.totalProducts), 'Products'),
        kpi(fmt(STATS.totalClicks), 'Clicks'),
        kpi(fmt(Math.round(STATS.totalConv)), 'Conversions'),
        kpi(STATS.currency + fmt(STATS.totalCost), 'Cost'),
        kpi(STATS.currency + fmt(STATS.totalRev), 'Revenue'),
        kpi(STATS.avgCr + '%', 'Avg CR'),
        kpi(STATS.avgRoas + 'x', 'Avg ROAS'),
    ].join('');

    // Set ROAS slider range dynamically based on account data
    const roasMax = Math.ceil(STATS.avgRoas * 1.5 / 10) * 10; // round up to nearest 10
    const sl = document.getElementById('profitSlider');
    sl.max = roasMax;
    sl.value = profitThreshold;
    document.getElementById('profitMax').textContent = roasMax.toFixed(0) + 'x';
    document.getElementById('profitMin').textContent = '0.5x';

    updateCampaignTable();

    // Set recommended badges
    document.getElementById('recProfitBadge').textContent =
        '\\u2192 Recommended: ' + STATS.avgRoas.toFixed(1) + 'x (avg ROAS)';
    document.getElementById('recVolumeBadge').textContent =
        '\\u2192 Recommended: ' + STATS.recClickThreshold + ' clicks';

    // Spend-based threshold panel
    document.getElementById('spendCurrencySymbol').textContent = STATS.currency;
    document.getElementById('targetCpaInput').value = Math.round(STATS.avgCpa) || 30;
    updateSpendDisplay();
    document.getElementById('targetCpaInput').addEventListener('input', updateSpendDisplay);
    const hintTrigger = document.getElementById('multHintTrigger');
    const hintBox = document.getElementById('multHintBox');
    hintTrigger.addEventListener('mouseenter', () => hintBox.style.display = 'block');
    hintTrigger.addEventListener('mouseleave', () => hintBox.style.display = 'none');

    update();
}}

function kpi(val, label) {{
    return '<div class="kpi"><div class="val">' + val + '</div><div class="lbl">' + label + '</div></div>';
}}
function fmt(n) {{ return Number(n).toLocaleString('it-IT'); }}
function fmtC(n) {{ return STATS.currency + Number(n).toLocaleString('it-IT', {{maximumFractionDigits:0}}); }}

// ── Toggle handlers ─────────────────────────────────────
function toggleMetric() {{
    useRoas = !useRoas;
    const el = document.getElementById('metricToggle');
    el.classList.toggle('off', !useRoas);
    const sl = document.getElementById('profitSlider');
    if (useRoas) {{
        const roasMax = Math.ceil(STATS.avgRoas * 1.5 / 10) * 10;
        sl.min = 0.5; sl.max = roasMax; sl.step = 0.1; sl.value = profitThreshold;
        document.getElementById('profitLabel').textContent = 'ROAS Threshold';
        document.getElementById('profitMin').textContent = '0.5x';
        document.getElementById('profitMax').textContent = roasMax.toFixed(0) + 'x';
        document.getElementById('recProfitBadge').textContent =
            '\\u2192 Recommended: ' + STATS.avgRoas.toFixed(1) + 'x (avg ROAS)';
    }} else {{
        sl.min = 1; sl.max = 200; sl.step = 1; sl.value = 50;
        profitThreshold = 50;
        document.getElementById('profitLabel').textContent = 'CPA Threshold';
        document.getElementById('profitMin').textContent = STATS.currency + '1';
        document.getElementById('profitMax').textContent = STATS.currency + '200';
        const avgCpa = STATS.totalConv > 0 ? Math.round(STATS.totalCost / STATS.totalConv) : 50;
        document.getElementById('recProfitBadge').textContent =
            '\\u2192 Recommended: ' + STATS.currency + avgCpa + ' (avg CPA)';
    }}
    update();
}}

function toggleVolume() {{
    useCost = !useCost;
    const el = document.getElementById('volumeToggle');
    el.classList.toggle('off', !useCost);
    const sl = document.getElementById('volumeSlider');
    if (useCost) {{
        sl.min = 1; sl.max = 500; sl.step = 1; sl.value = 20;
        volumeThreshold = 20;
        document.getElementById('volumeLabel').textContent = 'Cost Threshold';
        document.getElementById('volumeMin').textContent = STATS.currency + '1';
        document.getElementById('volumeMax').textContent = STATS.currency + '500';
        document.getElementById('recVolumeBadge').textContent =
            '\\u2192 Recommended: ' + STATS.currency + Math.round(STATS.recClickThreshold * STATS.totalCost / STATS.totalClicks);
    }} else {{
        sl.min = 1; sl.max = 500; sl.step = 1;
        sl.value = STATS.recClickThreshold;
        volumeThreshold = STATS.recClickThreshold;
        document.getElementById('volumeLabel').textContent = 'Clicks Threshold';
        document.getElementById('volumeMin').textContent = '1';
        document.getElementById('volumeMax').textContent = '500';
        document.getElementById('recVolumeBadge').textContent =
            '\\u2192 Recommended: ' + STATS.recClickThreshold + ' clicks';
    }}
    update();
}}

function setRecommendedProfit() {{
    if (useRoas) {{
        profitThreshold = STATS.avgRoas;
        document.getElementById('profitSlider').value = profitThreshold;
    }} else {{
        const avgCpa = STATS.totalConv > 0 ? Math.round(STATS.totalCost / STATS.totalConv) : 50;
        profitThreshold = avgCpa;
        document.getElementById('profitSlider').value = profitThreshold;
    }}
    update();
}}

function setRecommendedVolume() {{
    if (!useCost) {{
        volumeThreshold = STATS.recClickThreshold;
        document.getElementById('volumeSlider').value = volumeThreshold;
    }} else {{
        const avgCpc = STATS.totalClicks > 0 ? STATS.totalCost / STATS.totalClicks : 0.5;
        volumeThreshold = Math.round(STATS.recClickThreshold * avgCpc);
        document.getElementById('volumeSlider').value = volumeThreshold;
    }}
    update();
}}

function setMultiplier(val, btn) {{
    spendMultiplier = val;
    document.querySelectorAll('#multiplierBtns button').forEach(b => {{
        b.style.background = 'white';
        b.style.color = 'var(--ink-muted)';
        b.style.borderColor = 'var(--border)';
        b.style.fontWeight = '500';
    }});
    btn.style.background = 'var(--accent)';
    btn.style.color = 'white';
    btn.style.borderColor = 'var(--accent)';
    btn.style.fontWeight = '700';
    updateSpendDisplay();
}}

function updateSpendDisplay() {{
    const cpa = parseFloat(document.getElementById('targetCpaInput').value) || 0;
    const threshold = Math.round(cpa * spendMultiplier);
    document.getElementById('spendThresholdDisplay').textContent =
        threshold > 0 ? STATS.currency + threshold : '\u2014';
}}

function applySpendThreshold() {{
    const cpa = parseFloat(document.getElementById('targetCpaInput').value) || 0;
    const threshold = Math.round(cpa * spendMultiplier);
    if (threshold <= 0) return;
    if (!useCost) toggleVolume();
    const sl = document.getElementById('volumeSlider');
    sl.max = Math.max(parseFloat(sl.max), threshold * 1.5);
    sl.value = threshold;
    volumeThreshold = threshold;
    update();
}}

// ── Slider listeners ────────────────────────────────────
document.getElementById('profitSlider').addEventListener('input', function() {{
    profitThreshold = parseFloat(this.value);
    update();
}});
document.getElementById('volumeSlider').addEventListener('input', function() {{
    volumeThreshold = parseFloat(this.value);
    update();
}});

// ── Main update ─────────────────────────────────────────
function update() {{
    // Update slider displays
    if (useRoas) {{
        document.getElementById('profitValue').textContent = profitThreshold.toFixed(1) + 'x';
    }} else {{
        document.getElementById('profitValue').textContent = STATS.currency + Math.round(profitThreshold);
    }}
    if (useCost) {{
        document.getElementById('volumeValue').textContent = STATS.currency + Math.round(volumeThreshold);
    }} else {{
        document.getElementById('volumeValue').textContent = Math.round(volumeThreshold) + ' clicks';
    }}

    // Bucket products — P is array of [catIdx, clicks, impr, cost, conv, revenue, roas, cr]
    let profitable=[], costly=[], flukes=[], meh=[];
    let zombieList=[], zeroConvList=[], costlyWasteList=[];

    for (let i = 0; i < P.length; i++) {{
        const p = P[i];
        const volume = useCost ? p[3] : p[1]; // cost or clicks
        let isProfitable;
        if (useRoas) {{
            isProfitable = p[6] >= profitThreshold; // roas
        }} else {{
            const cpa = p[4] > 0 ? p[3] / p[4] : Infinity; // cost / conv
            isProfitable = cpa <= profitThreshold;
        }}
        const hasVolume = volume >= volumeThreshold;

        if (p[2] === 0) {{ zombieList.push(p); continue; }} // impr
        if (p[4] === 0) {{ zeroConvList.push(p); }} // conv

        if (hasVolume && isProfitable) profitable.push(p);
        else if (hasVolume && !isProfitable) {{ costly.push(p); if (p[4] === 0) costlyWasteList.push(p); }}
        else if (!hasVolume && isProfitable) flukes.push(p);
        else meh.push(p);
    }}

    // Update quadrant counts
    const costSum = arr => arr.reduce((s,p) => s + p[3], 0);

    document.getElementById('cProfitable').textContent = profitable.length;
    document.getElementById('dProfitable').textContent = fmtC(costSum(profitable)) + ' cost';

    document.getElementById('cCostly').textContent = costly.length;
    document.getElementById('dCostly').textContent = fmtC(costSum(costly)) + ' wasted';

    document.getElementById('cFlukes').textContent = flukes.length;
    document.getElementById('dFlukes').textContent = 'Low volume, look good';

    document.getElementById('cMeh').textContent = meh.length;
    document.getElementById('dMeh').textContent = 'Insufficient data';

    document.getElementById('totalLabel').textContent =
        fmt(P.length) + ' products total';

    // Axis legend
    const xLabel = useCost ? 'Cost &ge; ' + fmtC(volumeThreshold) : 'Clicks &ge; ' + Math.round(volumeThreshold);
    const yLabel = useRoas ? 'ROAS &ge; ' + profitThreshold.toFixed(1) + 'x'
                           : 'CPA &le; ' + STATS.currency + Math.round(profitThreshold);
    document.getElementById('axisLegend').innerHTML =
        '<span>&#x2194; X: ' + xLabel + '</span>' +
        '<span>&#x2195; Y: ' + yLabel + '</span>';

    // Bottom stats
    document.getElementById('bottomStats').innerHTML =
        '<div class="bottom-stat">Zombies: <strong>' + fmt(zombieList.length) + '</strong></div>' +
        '<div class="bottom-stat">Zero Conv: <strong>' + fmt(zeroConvList.length) + '</strong></div>' +
        '<div class="bottom-stat">Costly waste: <strong>' + fmtC(costSum(costlyWasteList)) + '</strong></div>';

    // Verdict text
    const totalCostAll = STATS.totalCost;
    const costlyPct = (costSum(costly) / totalCostAll * 100).toFixed(1);
    const profitablePct = (costSum(profitable) / totalCostAll * 100).toFixed(1);

    let verdict = '';
    if (costly.length > 0 && parseFloat(costlyPct) > 3) {{
        verdict += '<p><strong>' + costly.length + ' costly products</strong> account for <strong>' +
            costlyPct + '%</strong> of total spend (' + fmtC(costSum(costly)) + '). These have enough data to be reliably unprofitable.</p>';
    }} else if (costly.length > 0) {{
        verdict += '<p><strong>' + costly.length + ' costly products</strong> account for only <strong>' +
            costlyPct + '%</strong> of spend. Probably not worth a separate campaign.</p>';
    }}
    verdict += '<p><strong>' + profitable.length + ' profitable products</strong> drive ' + profitablePct + '% of spend.</p>';
    if (flukes.length > 50) {{
        verdict += '<p style="color:var(--warning)"><strong>' + flukes.length + ' flukes</strong> look profitable but have low volume &mdash; many of these are noise, not signal.</p>';
    }}

    document.getElementById('currentVerdict').innerHTML = verdict;

    // Zombie subcategory analysis (Lolk: only category-level zombies warrant a campaign)
    const zombieCats = getZombieCategories(zombieList, P);
    if (zombieCats.length > 0) {{
        let zhtml = '<table style="margin-top:4px;font-size:12px;width:100%"><thead><tr>' +
            '<th style="background:var(--ink);color:white;padding:6px 10px;font-size:11px;text-align:left">Zombie Category</th>' +
            '<th style="background:var(--ink);color:white;padding:6px 10px;font-size:11px;text-align:right">Products</th>' +
            '<th style="background:var(--ink);color:white;padding:6px 10px;font-size:11px;text-align:right">Zombie %</th>' +
            '<th style="background:var(--ink);color:white;padding:6px 10px;font-size:11px;text-align:left">Verdict</th>' +
            '</tr></thead><tbody>';
        zombieCats.forEach(d => {{
            const name = CATS[d.ci] || '(unknown)';
            const verdict = d.pct === 100
                ? '<span style="color:var(--success);font-weight:600">Valid zombie campaign</span>'
                : '<span style="color:var(--ink-muted)">Partial — noise</span>';
            zhtml += '<tr><td style="padding:5px 10px">' + name + '</td>' +
                '<td style="padding:5px 10px;text-align:right">' + d.zn + '/' + d.total + '</td>' +
                '<td style="padding:5px 10px;text-align:right">' + d.pct + '%</td>' +
                '<td style="padding:5px 10px">' + verdict + '</td></tr>';
        }});
        zhtml += '</tbody></table>';
        document.getElementById('zombieCatDetail').innerHTML =
            '<div style="font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">' +
            'Zombie categories (' + zombieCats.length + ')</div>' + zhtml;
    }} else {{
        document.getElementById('zombieCatDetail').innerHTML = '';
    }}

    // Category table
    updateCategoryTable(profitable, costly);

    // Bucket summary table
    updateBucketSummary(profitable, costly, flukes, meh, zombieList, zeroConvList, costlyWasteList);

    // Rec panel (dynamic — depends on current bucket state)
    buildRecPanel(profitable, costly, zombieCats);
}}

// ── Bucket metrics helper ────────────────────────────────
function bucketMetrics(arr) {{
    let n=arr.length, clicks=0, cost=0, conv=0, rev=0;
    for (let i=0; i<arr.length; i++) {{
        clicks += arr[i][1];
        cost   += arr[i][3];
        conv   += arr[i][4];
        rev    += arr[i][5];
    }}
    const roas = cost > 0 ? rev / cost : 0;
    const cpa  = conv > 0 ? cost / conv : 0;
    return {{n, clicks, cost, conv, rev, roas, cpa}};
}}

function updateBucketSummary(profitable, costly, flukes, meh, zombieList, zeroConvList, costlyWasteList) {{
    const buckets = [
        {{ label: 'Profitable', cls: 'bh-profitable', data: profitable }},
        {{ label: 'Flukes',     cls: 'bh-flukes',     data: flukes }},
        {{ label: 'Costly',     cls: 'bh-costly',     data: costly }},
        {{ label: 'Meh',        cls: 'bh-meh',        data: meh }},
        {{ label: 'Zombies',    cls: 'bh-zombies',     data: zombieList }},
        {{ label: 'Zero Conv',  cls: 'bh-zeroconv',   data: zeroConvList }},
        {{ label: 'Costly Waste', cls: 'bh-costlywaste', data: costlyWasteList }},
    ];
    const metrics = buckets.map(b => bucketMetrics(b.data));

    const fmtR = v => v > 0 ? v.toFixed(1) + 'x' : '&mdash;';
    const fmtCpa = v => v > 0 ? fmtC(v) : '&mdash;';

    let headerRow = '<tr>' + buckets.map((b,i) =>
        '<th class="' + b.cls + ' num">' + b.label + '</th>'
    ).join('') + '</tr>';

    const rows = [
        {{ label: 'Products', fn: (m,i) => fmt(m.n) }},
        {{ label: 'Clicks',   fn: (m,i) => fmt(m.clicks) }},
        {{ label: 'Cost',     fn: (m,i) => fmtC(m.cost) }},
        {{ label: 'Conv',     fn: (m,i) => fmt(Math.round(m.conv)) }},
        {{ label: 'Revenue',  fn: (m,i) => fmtC(m.rev) }},
        {{ label: 'ROAS',     fn: (m,i) => fmtR(m.roas) }},
        {{ label: 'CPA',      fn: (m,i) => fmtCpa(m.cpa) }},
    ];

    let html = '<table><thead>' + headerRow + '</thead><tbody>';
    rows.forEach(row => {{
        html += '<tr><td style="font-weight:600;font-size:12px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.3px;padding:6px 12px;">' + row.label + '</td>';
        // Wait - no label column, just the 7 bucket columns
    }});

    // Total of the 4 exclusive buckets (proof column)
    const allFour = [...profitable, ...flukes, ...costly, ...meh];
    const totalM = bucketMetrics(allFour);

    // Rebuild properly: super-header + column headers + 4 buckets + Total + 3 diagnostics
    const thBase = 'font-size:11px;text-transform:uppercase;letter-spacing:0.3px;padding:10px 12px;';
    const thTotal = 'background:#2a2a2a;color:white;font-size:11px;text-transform:uppercase;letter-spacing:0.3px;padding:10px 12px;text-align:right;font-weight:700;border-left:2px solid var(--teal);border-right:2px solid var(--teal);';
    const tdTotal = 'font-weight:700;background:#f0fafa;border-left:2px solid var(--teal);border-right:2px solid var(--teal);';
    html = '<table><thead>' +
        '<tr>' +
        '<th style="background:var(--ink);color:white;' + thBase + '"></th>' +
        '<th colspan="5" style="background:var(--ink);color:white;' + thBase + 'text-align:center;">4 Buckets &mdash; mutually exclusive</th>' +
        '<th colspan="3" style="background:var(--ink-muted);color:white;' + thBase + 'text-align:center;font-style:italic;">Diagnostics &mdash; overlap with buckets</th>' +
        '</tr>' +
        '<tr><th style="background:var(--ink);color:white;' + thBase + '"></th>' +
        buckets.slice(0,4).map(b => '<th class="' + b.cls + ' num">' + b.label + '</th>').join('') +
        '<th style="' + thTotal + '">Total</th>' +
        buckets.slice(4).map(b => '<th class="' + b.cls + ' num">' + b.label + '</th>').join('') +
        '</tr>' +
        '</thead><tbody>';

    rows.forEach(row => {{
        html += '<tr><td style="font-weight:600;font-size:11px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.3px;">' + row.label + '</td>' +
            metrics.slice(0,4).map(m => '<td class="num">' + row.fn(m) + '</td>').join('') +
            '<td class="num" style="' + tdTotal + '">' + row.fn(totalM) + '</td>' +
            metrics.slice(4).map(m => '<td class="num">' + row.fn(m) + '</td>').join('') +
            '</tr>';
    }});
    html += '</tbody></table>';

    document.getElementById('bucketSummary').innerHTML = html;
}}

// ── Campaign table (static) ─────────────────────────────
function updateCampaignTable() {{
    // CAMPS: [name, products, clicks, impr, cost, conv, revenue, roas]
    const sorted = [...CAMPS].sort((a, b) => b[4] - a[4]);
    let tProds=new Set(), tClicks=0, tCost=0, tConv=0, tRev=0;
    // products overlap between campaigns so we just sum for total (may double count)
    let tProdsSum=0;
    sorted.forEach(c => {{ tProdsSum+=c[1]; tClicks+=c[2]; tCost+=c[4]; tConv+=c[5]; tRev+=c[6]; }});

    const rows = sorted.map(c => {{
        const roas = c[7] > 0 ? c[7].toFixed(1) + 'x' : '&mdash;';
        const cpa  = c[5] > 0 ? fmtC(c[4] / c[5]) : '&mdash;';
        return '<tr><td>' + c[0] + '</td>' +
            '<td class="num">' + fmt(c[1]) + '</td>' +
            '<td class="num">' + fmt(c[2]) + '</td>' +
            '<td class="num">' + fmtC(c[4]) + '</td>' +
            '<td class="num">' + fmt(Math.round(c[5])) + '</td>' +
            '<td class="num">' + fmtC(c[6]) + '</td>' +
            '<td class="num">' + roas + '</td>' +
            '<td class="num">' + cpa + '</td></tr>';
    }});

    const totalRoas = tCost > 0 ? (tRev / tCost).toFixed(1) + 'x' : '&mdash;';
    const totalCpa  = tConv > 0 ? fmtC(tCost / tConv) : '&mdash;';
    rows.push('<tr style="font-weight:600;border-top:2px solid var(--ink);background:var(--paper-warm)">' +
        '<td>Total</td>' +
        '<td class="num">' + fmt(STATS.totalProducts) + '</td>' +
        '<td class="num">' + fmt(tClicks) + '</td>' +
        '<td class="num">' + fmtC(tCost) + '</td>' +
        '<td class="num">' + fmt(Math.round(tConv)) + '</td>' +
        '<td class="num">' + fmtC(tRev) + '</td>' +
        '<td class="num">' + totalRoas + '</td>' +
        '<td class="num">' + totalCpa + '</td></tr>');

    document.getElementById('campBody').innerHTML = rows.join('');
    document.getElementById('campCount').textContent =
        '(' + CAMPS.length + ' campaign' + (CAMPS.length !== 1 ? 's' : '') + ')';
}}

// ── Zombie category analysis (Lolk) ─────────────────────
function getZombieCategories(zombieList, allProducts) {{
    const catTotal = {{}}, catZombie = {{}};
    allProducts.forEach(p => {{ catTotal[p[0]] = (catTotal[p[0]] || 0) + 1; }});
    zombieList.forEach(p => {{ catZombie[p[0]] = (catZombie[p[0]] || 0) + 1; }});
    return Object.entries(catZombie)
        .map(([ci, zn]) => ({{
            ci: parseInt(ci),
            zn,
            total: catTotal[ci] || 0,
            pct: Math.round(zn / (catTotal[ci] || 1) * 100)
        }}))
        .filter(d => d.pct >= 80)
        .sort((a, b) => b.zn - a.zn);
}}

function updateCategoryTable(profitable, costly) {{
    // catIdx -> stats
    const cats = {{}};
    for (let i = 0; i < P.length; i++) {{
        const p = P[i];
        const ci = p[0]; // catIdx
        if (!cats[ci]) cats[ci] = {{products:0, clicks:0, cost:0, conv:0, value:0, best:0, unprof:0}};
        cats[ci].products++;
        cats[ci].clicks += p[1];
        cats[ci].cost += p[3];
        cats[ci].conv += p[4];
        cats[ci].value += p[5];
    }}
    profitable.forEach(p => {{ if (cats[p[0]]) cats[p[0]].best++; }});
    costly.forEach(p => {{ if (cats[p[0]]) cats[p[0]].unprof++; }});

    const sorted = Object.entries(cats).sort((a,b) => b[1].cost - a[1].cost);
    const tbody = document.getElementById('catBody');
    tbody.innerHTML = sorted.slice(0, 20).map(([ci, d]) => {{
        const name = CATS[parseInt(ci)] || '(unknown)';
        const roas = d.cost > 0 ? (d.value / d.cost).toFixed(1) : '0';
        return '<tr><td>' + name + '</td>' +
            '<td class="num">' + fmt(d.products) + '</td>' +
            '<td class="num">' + fmt(d.clicks) + '</td>' +
            '<td class="num">' + fmtC(d.cost) + '</td>' +
            '<td class="num">' + fmt(Math.round(d.conv)) + '</td>' +
            '<td class="num">' + roas + 'x</td>' +
            '<td class="num" style="color:var(--success);font-weight:600">' + d.best + '</td>' +
            '<td class="num" style="color:var(--danger);font-weight:600">' + d.unprof + '</td></tr>';
    }}).join('');
}}

// ── Recommendation Panel (dynamic — called from update()) ─
function buildRecPanel(profitable, costly, zombieCats) {{
    const el = document.getElementById('recPanel');
    const recClicks = STATS.recClickThreshold;
    const recBest = STATS.recBestThreshold;
    const avgCr = STATS.avgCr;
    const weeksN = STATS.weeks;
    const convPerWeek = arr => arr.reduce((s,p) => s + p[4], 0) / weeksN;
    const costSum = arr => arr.reduce((s,p) => s + p[3], 0);

    // Count products at statistical thresholds
    let unprofAtRec = 0, bestAtRec = 0, unprofCost = 0;
    for (let i = 0; i < P.length; i++) {{
        const p = P[i];
        if (p[1] >= recClicks && p[4] === 0) {{ unprofAtRec++; unprofCost += p[3]; }}
        if (p[1] >= recBest && p[7] >= avgCr * 2 && p[4] >= 2) bestAtRec++;
    }}
    const unprofPct = (unprofCost / STATS.totalCost * 100).toFixed(1);
    const costlyCost = costSum(costly);
    const costlyPct = STATS.totalCost > 0 ? costlyCost / STATS.totalCost * 100 : 0;

    // Bestseller avg ROAS (from current profitable bucket)
    const bestAvgRoas = profitable.length > 0
        ? profitable.reduce((s,p) => s + p[6], 0) / profitable.length
        : STATS.avgRoas;
    const recRoasTarget = (bestAvgRoas * 0.70).toFixed(1);

    let html = '';

    // ── 1. Campaign Structure Verdict (Lolk: be opinionated) ──
    let structureTitle, structureBody, structureCls;
    const hasEnoughBest = profitable.length >= 10;
    const hasSignificantCostly = costlyPct >= 8;
    const hasValidZombieCategories = zombieCats.some(d => d.pct === 100);

    if (!hasEnoughBest) {{
        structureCls = 'warn';
        structureTitle = 'Recommended Structure: Single Campaign';
        structureBody = 'Only <strong>' + profitable.length + ' profitable products</strong> at current thresholds &mdash; not enough to justify splitting. ' +
            'Let Smart Bidding work with the full dataset. ' +
            '<strong>Raise thresholds</strong> until you have at least 10 confident bestsellers.';
    }} else if (!hasSignificantCostly) {{
        structureCls = 'good';
        structureTitle = 'Recommended Structure: Bestseller + Main';
        structureBody = 'Costly products account for only <strong>' + costlyPct.toFixed(1) + '% of spend</strong> &mdash; not worth a separate campaign. ' +
            'Focus on isolating your <strong>' + profitable.length + ' bestsellers</strong> and setting their target at ' + recRoasTarget + 'x ROAS.';
    }} else if (costlyPct < 15) {{
        structureCls = 'info';
        structureTitle = 'Recommended Structure: Bestseller + Main + Unprofitable';
        structureBody = 'Costly products burn <strong>' + costlyPct.toFixed(1) + '% of spend</strong> (' + fmtC(costlyCost) + '). ' +
            'Worth isolating. Use: <strong>Bestseller</strong> (target ' + recRoasTarget + 'x) &rarr; <strong>Main</strong> &rarr; <strong>Unprofitable</strong> (aggressive ROAS target).';
    }} else {{
        structureCls = 'bad';
        structureTitle = 'Recommended Structure: Full Segmentation';
        structureBody = 'Costly products represent <strong>' + costlyPct.toFixed(1) + '% of spend</strong> (' + fmtC(costlyCost) + '). ' +
            'Full structure justified. Apply category-level quotas for bestsellers.';
    }}
    if (hasValidZombieCategories) {{
        const validZCats = zombieCats.filter(d => d.pct === 100).map(d => CATS[d.ci] || '(unknown)').join(', ');
        structureBody += ' <br><br><strong>+ Zombie campaign</strong> for entire zero-traffic categories: <em>' + validZCats + '</em> (set lower ROAS target to enter new auctions).';
    }}
    html += '<div class="rec-card ' + structureCls + '">' +
        '<h3>' + structureTitle + '</h3>' +
        '<p>' + structureBody + '</p></div>';

    // ── 2. Data Fragmentation Risk (Lolk: every split hurts Smart Bidding) ──
    const restConv = convPerWeek(P) - convPerWeek(profitable) - convPerWeek(costly);
    const fragRows = [
        {{ name: 'Bestseller campaign', cpw: convPerWeek(profitable), show: profitable.length >= 5 }},
        {{ name: 'Unprofitable campaign', cpw: convPerWeek(costly), show: costly.length >= 5 }},
        {{ name: 'Main campaign (rest)', cpw: Math.max(restConv, 0), show: true }},
    ].filter(r => r.show);

    const minViable = 7.5; // 30 conv/month
    const anyRisk = fragRows.some(r => r.cpw < minViable);
    const fragCls = anyRisk ? 'warn' : 'good';
    let fragHtml = '<table style="width:100%;margin:8px 0;font-size:12px;border-collapse:collapse">' +
        '<tr style="background:var(--paper-warm)"><th style="padding:5px 8px;text-align:left;font-size:11px">Campaign</th>' +
        '<th style="padding:5px 8px;text-align:right;font-size:11px">Conv/week</th>' +
        '<th style="padding:5px 8px;text-align:left;font-size:11px">Status</th></tr>';
    fragRows.forEach(r => {{
        const ok = r.cpw >= minViable;
        const status = ok
            ? '<span style="color:var(--success)">&#10003; OK (' + (r.cpw * 4.3).toFixed(0) + '/mo)</span>'
            : '<span style="color:var(--danger)">&#9888; Low (' + (r.cpw * 4.3).toFixed(0) + '/mo &mdash; need 30+)</span>';
        fragHtml += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 8px">' + r.name + '</td>' +
            '<td style="padding:5px 8px;text-align:right">' + r.cpw.toFixed(1) + '</td>' +
            '<td style="padding:5px 8px">' + status + '</td></tr>';
    }});
    fragHtml += '</table>';
    html += '<div class="rec-card ' + fragCls + '">' +
        '<h3>Data Fragmentation Risk</h3>' +
        '<p>Smart Bidding needs &ge;30 conversions/month per campaign to learn effectively. ' +
        'Every split you create fragments this data.</p>' +
        fragHtml +
        (anyRisk ? '<p style="color:var(--danger);margin-top:4px">Some campaigns would fall below the minimum. Consolidate or raise thresholds.</p>' : '') +
        '</div>';

    // ── 3. Statistical Thresholds ──
    html += '<div class="rec-card info">' +
        '<h3>Statistical Thresholds (95% confidence)</h3>' +
        '<p>Your account converts at <strong>' + avgCr + '%</strong>. Based on this:</p>' +
        '<div class="formula">Unprofitable: &ge; <strong>' + recClicks + ' clicks</strong> with 0 conversions<br>' +
        'n &ge; ln(0.05) / ln(1 - ' + (avgCr/100).toFixed(4) + ') = ' + recClicks + '</div>' +
        '<div class="formula">Bestseller: &ge; <strong>' + recBest + ' clicks</strong> with &ge;2x avg CR<br>' +
        'n &ge; z&sup2; &times; p(1-p) / margin&sup2; = ' + recBest + '</div>' +
        '<p style="margin-top:8px">Below these thresholds, labels are <strong>noise</strong>, not signal. ' +
        'A product with 12 clicks and 0 conversions is not unprofitable &mdash; it just has not had enough traffic.</p>' +
        '</div>';

    // ── 4. Unprofitable assessment ──
    if (parseFloat(unprofPct) < 3) {{
        html += '<div class="rec-card warn">' +
            '<h3>Unprofitable: Low Impact (' + unprofPct + '% of spend)</h3>' +
            '<p>At ' + recClicks + ' clicks, only <strong>' + unprofAtRec + ' products</strong> (' +
            fmtC(unprofCost) + ') are truly unprofitable. Not worth a separate campaign &mdash; ' +
            'let Smart Bidding handle them.</p></div>';
    }} else if (parseFloat(unprofPct) < 8) {{
        html += '<div class="rec-card info">' +
            '<h3>Unprofitable: Moderate (' + unprofPct + '% of spend)</h3>' +
            '<p>' + unprofAtRec + ' products (' + fmtC(unprofCost) + ') are unprofitable at a statistically ' +
            'valid threshold. Worth addressing, but prioritize bestseller scaling first.</p></div>';
    }} else {{
        html += '<div class="rec-card good">' +
            '<h3>Unprofitable: Significant (' + unprofPct + '% of spend)</h3>' +
            '<p>' + unprofAtRec + ' products (' + fmtC(unprofCost) + ') are burning cash with enough ' +
            'data to be confident. Create an unprofitable campaign.</p></div>';
    }}

    // ── 5. Bestseller assessment with ROAS headroom (Lolk) ──
    if (bestAtRec < 5) {{
        html += '<div class="rec-card warn">' +
            '<h3>Bestsellers: Too Few (' + bestAtRec + ')</h3>' +
            '<p>Not enough statistically confirmed bestsellers. Keep everything in one campaign.</p></div>';
    }} else {{
        const bCats = {{}};
        for (let i = 0; i < P.length; i++) {{
            const p = P[i];
            if (p[1] >= recBest && p[7] >= avgCr * 2 && p[4] >= 2) {{
                bCats[p[0]] = (bCats[p[0]] || 0) + 1;
            }}
        }}
        const topCat = Object.entries(bCats).sort((a,b) => b[1] - a[1])[0];
        const topPct = topCat ? (topCat[1] / bestAtRec * 100).toFixed(0) : 0;
        let catWarn = '';
        if (topPct > 60) {{
            const catName = CATS[parseInt(topCat[0])] || '(unknown)';
            catWarn = '<p style="color:var(--warning);margin-top:6px"><strong>Category concentration:</strong> ' +
                topPct + '% of bestsellers are in &ldquo;' + catName + '&rdquo;. Use category-level quotas (top N per category).</p>';
        }}
        // ROAS headroom guidance (Lolk: set target BELOW current ROAS)
        const roasHeadroom = '<p style="margin-top:8px"><strong>ROAS target:</strong> Bestsellers average <strong>' + bestAvgRoas.toFixed(1) + 'x</strong>. ' +
            'Set campaign target at <strong>' + recRoasTarget + 'x</strong> (70% of actual) to give Smart Bidding headroom to scale &mdash; ' +
            'not at or above their current ROAS.</p>';

        html += '<div class="rec-card good">' +
            '<h3>Bestsellers: ' + bestAtRec + ' products across ' + Object.keys(bCats).length + ' categories</h3>' +
            roasHeadroom + catWarn + '</div>';
    }}

    // ── 6. Profitability Thresholds ──
    const avgCpa = STATS.totalConv > 0 ? Math.round(STATS.totalCost / STATS.totalConv) : 0;
    html += '<div class="rec-card info">' +
        '<h3>Profitability Thresholds</h3>' +
        '<div class="formula">Avg account ROAS: <strong>' + STATS.avgRoas.toFixed(1) + 'x</strong> &mdash; the performance floor<br>' +
        'Avg account CPA: <strong>' + STATS.currency + avgCpa + '</strong> &mdash; the cost ceiling</div>' +
        '<p>The true ROAS breakeven depends on your margin (e.g. 30% margin &rarr; 3.3x breakeven). ' +
        'Since margin data is unavailable, avg ROAS is used as a proxy: products running below it are underperforming the account average. ' +
        'Bestsellers typically hit <strong>' + (STATS.avgRoas * 2).toFixed(0) + 'x+</strong> ROAS ' +
        '(' + STATS.currency + Math.round(avgCpa / 2) + ' or less CPA).</p>' +
        '</div>';

    el.innerHTML = html;
}}

// ── Start ───────────────────────────────────────────────
init();
</script>
</body>
</html>"""

    output_path = paths["reports"] / "threshold-recommender.html"
    with open(output_path, "w") as f:
        f.write(html)

    print(f"\nReport saved: {output_path}")
    print(f"Open with: open '{output_path}'")


if __name__ == "__main__":
    main()
