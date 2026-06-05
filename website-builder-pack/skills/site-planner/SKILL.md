---
name: site-planner
description: "Plans a WordPress website structure for a small business. Takes business details and recommends pages, site map, theme type (block or classic), navigation layout, and content priorities. Use when someone describes their business and wants to know what pages they need, how to organise their site, or which WordPress theme approach to use."
---

# Site Planner

Takes a business description and produces a practical WordPress site plan. No waffle, no options overload. One clear recommendation.

## What You Need From the User

Ask for anything not already provided:

1. **Business name** and what they do (industry, services, products)
2. **Target customers** (who visits the site and what they want)
3. **Primary goal** of the site (generate leads, sell products, book appointments, build credibility)
4. **Existing site?** (rebuild or starting fresh)
5. **Budget for plugins?** (free only, or willing to pay for premium)

## Process

### 1. Recommend Theme Type

Make one recommendation, not a menu:

- **Block theme (Full Site Editing)** for most businesses. Visual editing, no page builder dependency, modern, fast. Recommend this as default.
- **Classic theme** only if they specifically need WooCommerce with heavy customisation, or have an existing classic theme they want to keep.

Explain the choice in one sentence. Do not list pros and cons of both.

### 2. Recommend Pages

Based on the business type and goal, recommend a specific page list. Always include:

- **Home** (hero, value proposition, trust signals, primary CTA)
- **About** (story, team, credibility)
- **Contact** (form, phone, address, map)

Then add pages relevant to their business:

| Business Type | Additional Pages |
|---|---|
| Service business | Services (overview), individual service pages, testimonials/case studies |
| E-commerce | Shop, product categories, returns/shipping policy |
| Local business | Areas covered, Google reviews section, FAQs |
| Professional services | How it works, pricing/packages, resources/blog |
| Portfolio/creative | Portfolio/work, process |

Cap at 8-10 pages for a first build. More can come later.

### 3. Site Map

Present the page structure as a simple hierarchy:

```
Home
  About
  Services
    Service A
    Service B
  Testimonials
  Blog
  Contact
```

### 4. Navigation Recommendation

Recommend a main menu (5-7 items max) and a footer menu. Keep it simple.

**Main menu:** Only top-level pages that help visitors find what they need or take action. Always end with the primary CTA (Contact, Book a Call, Get a Quote).

**Footer menu:** Legal pages (Privacy, Terms), secondary links, social media.

### 5. Content Priorities

Rank the pages by build order. The most important pages come first:

1. Home (always first)
2. Primary conversion page (Contact, Book, Shop)
3. Core service/product pages
4. About
5. Supporting pages (blog, FAQs, testimonials)

## Output Format

```
## Site Plan: [Business Name]

### Theme Type
[Block theme / Classic theme] - [one sentence why]

### Pages
| Page | Purpose | Priority |
|---|---|---|
| Home | [purpose] | 1 |
| ... | ... | ... |

### Site Map
[hierarchy as above]

### Navigation
**Main menu:** [items]
**Footer menu:** [items]

### Build Order
1. [page] - [why first]
2. ...

### Notes
[Any specific recommendations: plugins to consider, content they should prepare, things to avoid]
```

## Tone

- Direct and practical
- No jargon. If you mention a WordPress term, explain it in plain English
- One recommendation per decision, not a list of options
- Treat the user as a capable business owner, not a developer

## Word Count

400-600 words total. Enough to be useful, not so much it overwhelms.

