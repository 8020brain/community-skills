---
name: page-builder
description: "Builds individual WordPress page templates with conversion-optimised layouts. Creates complete page files (HTML block markup for block themes, PHP templates for classic themes) with proper structure, CTA placement, and responsive design. Use when someone wants to build a specific page for their WordPress site: homepage, about page, services page, contact page, landing page, or any custom page."
---

# Page Builder

Creates complete WordPress page templates with layouts designed to convert visitors into customers. Each page follows CRO best practices: clear hierarchy, strategic CTA placement, trust signals, and mobile-friendly structure.

## What You Need From the User

Ask for anything not already provided:

1. **Page type** - home, about, services, contact, landing page, portfolio, pricing, FAQ, or custom
2. **Theme type** - block theme (HTML templates) or classic theme (PHP templates)
3. **Primary CTA** - what action should visitors take? (call, email, fill form, book, buy)
4. **Business context** - what does the business do, who are the customers
5. **Content available?** - do they have copy ready, or should you create placeholder structure

## Page Blueprints

### Homepage

| Section | Purpose | CRO Principle |
|---|---|---|
| Hero | Headline, subheadline, primary CTA, trust indicator | Attention: clear value proposition above the fold |
| Social proof bar | Client logos or "trusted by X businesses" | Interest: build credibility early |
| Services/features | 3-4 cards with icons, short descriptions | Interest: show what you offer |
| Testimonial | One strong quote with name and photo placeholder | Desire: real customer voice |
| How it works | 3 steps (simple process) | Desire: reduce uncertainty |
| Final CTA | Repeat primary CTA with supporting text | Action: last chance to convert |

### About Page

| Section | Purpose |
|---|---|
| Opening | Who you are, what you stand for (2-3 sentences) |
| Story | How and why the business started |
| Team | Founder/team profiles with photos |
| Values or approach | What makes you different (3-4 points) |
| CTA | Work with us / get in touch |

### Services Page (Overview)

| Section | Purpose |
|---|---|
| Intro | One sentence explaining what you do |
| Service cards | Each service with icon, title, short description, link to detail page |
| Why choose us | 3-4 differentiators |
| Testimonial | Relevant to services |
| CTA | Get a quote / book a consultation |

### Individual Service Page

| Section | Purpose |
|---|---|
| Hero | Service name, one-line description, CTA |
| What's included | Bullet list or feature grid |
| Process | How it works (3-5 steps) |
| Pricing | If applicable, or "get a quote" |
| FAQ | 3-5 common questions about this service |
| Testimonial | Specific to this service |
| CTA | Book / enquire / get started |

### Contact Page

| Section | Purpose |
|---|---|
| Heading | Clear "Get in Touch" or similar |
| Contact form | Name, email, phone (optional), message. Keep fields minimal |
| Direct contact | Phone number, email address, business hours |
| Location | Address, embedded map placeholder |
| Response time | "We typically reply within 24 hours" |

### Landing Page

| Section | Purpose | CRO Principle |
|---|---|---|
| Hero | Benefit headline, subheadline, single CTA | One goal, no distractions |
| Problem | Describe the pain point (2-3 sentences) | Agitate the need |
| Solution | What you offer and how it helps | Position as the answer |
| Features/benefits | 3-5 points with outcomes, not features | Focus on results |
| Social proof | Testimonials, logos, numbers | Build trust near the CTA |
| Risk reversal | Guarantee, free trial, no obligation | Remove barriers |
| Final CTA | Repeat the single CTA | Close |

No navigation menu on landing pages. Remove distractions.

## Output Rules

### Block Themes (HTML)

- Use WordPress block markup: `<!-- wp:group -->`, `<!-- wp:heading -->`, `<!-- wp:paragraph -->`, etc.
- Use `<!-- wp:columns -->` for side-by-side layouts
- Use `<!-- wp:cover -->` for hero sections with background images
- Set appropriate HTML tags on groups: `<header>`, `<section>`, `<footer>`
- Apply theme palette colours using class names (e.g., `has-primary-background-color`)
- Use `templateLock` on structural sections to prevent client breakage

### Classic Themes (PHP)

- Use proper template headers: `<?php /* Template Name: Homepage */ ?>`
- Call `get_header()` and `get_footer()`
- Use semantic HTML: `<section>`, `<article>`, `<aside>`
- Escape all output: `esc_html()`, `esc_url()`, `esc_attr()`
- Use translation functions for all text: `__('text', 'theme-slug')`
- Add CSS classes for styling hooks

### Both Themes

- Mobile-first responsive structure
- Primary CTA appears at least twice (hero and bottom of page)
- Use placeholder text that describes what goes there, not Lorem ipsum
- Mark all replaceable content clearly: `[Your headline here]`, `[Service description]`
- Keep sections distinct with clear visual separation

## Output Format

For each page, provide:

1. **File path** relative to theme root
2. **Complete file contents**
3. **Brief note** on what content the user needs to prepare for this page

```
## [Page Name]

**File:** `templates/page-[slug].html` (block) or `page-[slug].php` (classic)

[complete file contents]

### Content to Prepare
- Headline: [guidance]
- Hero image: [recommended dimensions]
- ...
```

## Tone

- Direct and practical
- No design jargon without explanation
- Explain CRO decisions briefly ("CTA repeated here because visitors who scroll this far are interested")
- Code is clean, minimal, and well-commented where logic matters

## Important

- Every page must have at least one clear CTA
- Homepage hero must communicate what the business does within 5 seconds of reading
- Do not add animations, sliders, or carousels. They hurt conversions and slow the site
- Keep forms short. Name, email, message. Every extra field reduces submissions
- Never use "Click here" as CTA text. Use action-specific text: "Get a Quote", "Book a Call", "Start Your Free Trial"

