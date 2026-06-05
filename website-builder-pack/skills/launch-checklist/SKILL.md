---
name: launch-checklist
description: "Produces a personalised pre-launch checklist for a WordPress website. Covers SEO basics, performance, mobile responsiveness, accessibility, security, content completeness, and conversion readiness. Tags each item as BLOCKER, IMPORTANT, or NICE-TO-HAVE. Use when someone is about to launch their WordPress site, wants a final check before going live, or needs to audit their site before publishing."
---

# Launch Checklist

Produces a practical, prioritised checklist before a WordPress site goes live. Not a generic list. Personalised to the site being launched.

## What You Need From the User

Ask for anything not already provided:

1. **Site URL** (local or staging) if available
2. **Business type** - what the site is for
3. **Pages built** - list of pages on the site
4. **Primary goal** - lead generation, sales, bookings, information
5. **Going live how?** - migrating from Local WP to hosting, or already on hosting

## Priority Tags

Every checklist item gets one tag:

- **BLOCKER** - must fix before launch. Site will break, lose traffic, or look unprofessional without it
- **IMPORTANT** - should fix before launch. Affects SEO, conversions, or user experience
- **NICE-TO-HAVE** - can do after launch without consequence

## Checklist Categories

### 1. Content Completeness

| Check | Tag |
|---|---|
| All pages have real content (no placeholder text remaining) | BLOCKER |
| All images have alt text describing the image | IMPORTANT |
| Contact details are correct (phone, email, address) | BLOCKER |
| Business hours listed if applicable | IMPORTANT |
| Privacy policy page exists | BLOCKER |
| Terms and conditions page exists (if selling or collecting data) | IMPORTANT |
| 404 page has helpful content and a link home | NICE-TO-HAVE |
| All internal links work (no broken links) | BLOCKER |
| No "test", "draft", or "sample" content visible | BLOCKER |

### 2. SEO Basics

| Check | Tag |
|---|---|
| Every page has a unique title tag (under 60 characters) | BLOCKER |
| Every page has a meta description (under 160 characters) | IMPORTANT |
| Homepage title includes business name and what you do | BLOCKER |
| URL slugs are clean and descriptive (e.g., `/services/plumbing` not `/page-2`) | IMPORTANT |
| One H1 per page, used for the main heading | IMPORTANT |
| Heading hierarchy is logical (H1 > H2 > H3, no skipping) | NICE-TO-HAVE |
| XML sitemap is generated and accessible at `/sitemap.xml` | IMPORTANT |
| Robots.txt allows search engines to crawl the site | BLOCKER |
| Google Search Console connected and sitemap submitted | IMPORTANT |
| "Discourage search engines" is unchecked in Settings > Reading | BLOCKER |

### 3. Performance

| Check | Tag |
|---|---|
| Images are optimised (compressed, correct dimensions, WebP where possible) | IMPORTANT |
| No oversized images (nothing over 500KB unless full-width hero) | IMPORTANT |
| Page loads in under 3 seconds on mobile | IMPORTANT |
| No unused plugins active | NICE-TO-HAVE |
| Caching plugin installed and configured (if on hosting) | IMPORTANT |
| Lazy loading enabled for below-fold images | NICE-TO-HAVE |

### 4. Mobile and Responsiveness

| Check | Tag |
|---|---|
| Site looks correct on mobile (320px - 480px) | BLOCKER |
| Site looks correct on tablet (768px - 1024px) | IMPORTANT |
| Text is readable without zooming on mobile (16px minimum) | BLOCKER |
| Buttons and links are tappable (minimum 44x44px touch target) | IMPORTANT |
| Navigation works on mobile (hamburger menu functions correctly) | BLOCKER |
| No horizontal scrolling on any page | BLOCKER |
| Forms are usable on mobile | BLOCKER |

### 5. Conversion Readiness

| Check | Tag |
|---|---|
| Primary CTA is visible above the fold on homepage | BLOCKER |
| Contact form works and sends to correct email address | BLOCKER |
| Phone number is click-to-call on mobile | IMPORTANT |
| Email address is a mailto link | NICE-TO-HAVE |
| Thank you / confirmation page or message after form submission | IMPORTANT |
| Google Analytics or equivalent tracking installed | IMPORTANT |
| Conversion tracking set up (form submissions, calls, purchases) | IMPORTANT |

### 6. Security

| Check | Tag |
|---|---|
| SSL certificate active (site loads on HTTPS) | BLOCKER |
| WordPress admin username is not "admin" | IMPORTANT |
| Strong admin password set | BLOCKER |
| WordPress, theme, and plugins are up to date | IMPORTANT |
| Login page protected (limit login attempts or similar) | NICE-TO-HAVE |
| Backup system in place (plugin or hosting-level) | IMPORTANT |
| File editing disabled in wp-config.php (`DISALLOW_FILE_EDIT`) | NICE-TO-HAVE |
| Theme PHP files include direct file access prevention (`if ( ! defined( 'ABSPATH' ) ) exit;`) | IMPORTANT |
| All theme output is escaped with `esc_html()`, `esc_url()`, or `esc_attr()` | IMPORTANT |
| Any forms in the theme use nonces | IMPORTANT |

### 7. Legal and Compliance

| Check | Tag |
|---|---|
| Privacy policy link in footer | BLOCKER |
| Cookie consent banner if using analytics or tracking (UK/EU requirement) | BLOCKER |
| Terms and conditions linked if applicable | IMPORTANT |
| Business registration details visible if legally required | NICE-TO-HAVE |

### 8. Go-Live Technical

| Check | Tag |
|---|---|
| Domain pointing to hosting correctly | BLOCKER |
| Permalinks set to "Post name" (Settings > Permalinks) | BLOCKER |
| WordPress address and site address match the live domain | BLOCKER |
| Search and replace done for local URLs (e.g., `localsite.local` to `yourdomain.com`) | BLOCKER |
| Email delivery tested (SMTP plugin if hosting doesn't handle it) | IMPORTANT |
| Favicon uploaded | IMPORTANT |
| Social sharing image (Open Graph) set for homepage | NICE-TO-HAVE |

## Recommended Plugins

Include this table in every checklist output. Adjust the "Notes" column based on the site type.

| Type | Why You Need It | Options |
|---|---|---|
| SEO | Title tags, meta descriptions, schema markup, XML sitemaps | Rank Math (free), Yoast SEO (free) |
| Caching | Speeds up the site for real visitors | WP Rocket (paid), LiteSpeed Cache (free), W3 Total Cache (free) |
| Security | Blocks brute force, monitors file changes, protects login | Solid Security (free), Wordfence (free) |
| Forms | Contact forms, lead capture, enquiry forms | WPForms (free/paid), Contact Form 7 (free), Fluent Forms (free/paid) |
| Backups | Automated off-site backups before anything goes wrong | UpdraftPlus (free/paid), BackWPup (free) |
| Image optimisation | Compresses images automatically on upload | Smush (free/paid), ShortPixel (paid), Imagify (free/paid) |
| Cookie consent | Legal requirement in UK and EU if using analytics or tracking | CookieYes (free/paid), Complianz (free/paid) |

Only include plugin types relevant to the site. A simple brochure site with no analytics doesn't need cookie consent tools. A site with no forms doesn't need a forms plugin.

Flag any plugin types already handled by the user's hosting (e.g., some hosts include caching at server level).

## Output Format

```
## Launch Checklist: [Business Name]

### Summary
- BLOCKERS: [count] items
- IMPORTANT: [count] items
- NICE-TO-HAVE: [count] items

### BLOCKERS (fix before launch)
1. [ ] [item] - [brief guidance on how to fix]
2. [ ] ...

### IMPORTANT (fix before or shortly after launch)
1. [ ] [item] - [brief guidance]
2. [ ] ...

### NICE-TO-HAVE (do when you get time)
1. [ ] [item] - [brief guidance]
2. [ ] ...

### Recommended Plugins
- [plugin] - [what it does] (free / paid)
- ...

### Post-Launch Actions
1. Submit sitemap to Google Search Console
2. Test all forms one more time on live site
3. Check site on your phone
4. Set up regular backups
5. Monitor for 404 errors in first week
```

## Personalisation

Adjust the checklist based on the business:

- **E-commerce:** Add WooCommerce checks (checkout flow, payment gateway, shipping, tax)
- **Local business:** Add Google Business Profile link, local schema markup, areas covered page
- **Service business:** Add form testing, booking system checks, testimonials present
- **Blog/content site:** Add RSS feed, social sharing buttons, category structure

Remove items that don't apply. A 5-page brochure site doesn't need WooCommerce checks.

## Tone

- Direct and practical
- Each item is a clear action, not a vague suggestion
- Brief guidance on HOW to fix, not just what to fix
- Encouraging but honest. Better to catch issues now than after launch

## Important

- Always check "Discourage search engines" setting. This is the number one launch mistake
- Always verify the contact form actually sends. Test it yourself if possible
- SSL is non-negotiable. No exceptions
- Cookie consent is legally required in the UK and EU. Do not skip this
- The checklist should be printable and usable as a standalone document

