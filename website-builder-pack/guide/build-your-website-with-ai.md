# Website Builder Skill Pack: How to Use

**By Zara Imrie, Clever Operators**
cleveroperators.com

---

## What This Pack Does

The Website Builder Skill Pack gives Claude everything it needs to build a complete WordPress website: from planning the pages to writing the copy. You describe your business. Claude does the building.

Ten skills are included:

| Skill | What It Does |
|---|---|
| `website-builder` | Runs the full build from start to finish. Use this for a complete site |
| `site-planner` | Plans your pages, site structure, and navigation |
| `theme-scaffolder` | Creates all your WordPress theme files |
| `page-builder` | Builds individual page templates with conversion-optimised layouts |
| `content-writer` | Writes copy for every page |
| `superhuman-writer` | Makes the copy sound like a real person wrote it |
| `seo-aeo` | Keyword planning before writing and SEO/AEO audit after copy is written |
| `wordpress-security-audit` | Scans your theme code for security vulnerabilities before upload |
| `wordpress-production-audit` | Server-level security checks to run after migrating to live hosting |
| `launch-checklist` | Audits the site before you go live |

---

## Before You Start

You'll need:

- [ ] **Claude Code** installed on your computer: claude.ai/code
- [ ] **Local WP** installed: localwp.com (free, runs WordPress on your computer)
- [ ] A new Local WP site created and WordPress installed
- [ ] Your business details: name, what you do, who your customers are, brand colours if you have them

---

## Step 1: Install the Skills

1. Drop the `website-builder-pack` folder anywhere inside your project folder
2. Open Claude Code in your project folder:

```
claude
```

3. Tell Claude to install the pack:

> "Install the website builder skill pack. The folder is at [path]."

Claude will copy the skill folders into `.claude/skills/`, create the folder if it doesn't exist, and leave any skills you already have untouched.

That's it. The skills are live.

---

## Step 2: Voice DNA (Handled Automatically)

The `superhuman-writer` skill makes your copy sound human. If it has a voice reference, it will write in your specific style, not a generic one.

You don't need to create this file yourself. During a full build, Claude asks about your brand voice in Stage 1 Discovery and writes `voice-dna.md` for you from your answers. If you use the superhuman-writer standalone, it will ask you a few questions and write the file itself before continuing.

If no voice reference is provided, the skill will still improve the copy. It just won't be tuned to your specific voice.

---

## Step 3: Build Your Site

### Option A: Full build (recommended)

Tell Claude you want a website. It will first ask whether you are building a brand new site or rebuilding an existing one, then work through all ten stages in order, confirming with you at each one before moving on.

After each confirmed stage, Claude saves a `website-build.md` file to your project folder. If you close Claude Code and come back another day, just open it again and say "continue my website build." Claude reads the file and picks up exactly where you left off, no need to repeat anything.

**Say:**
> "Build me a website for my business."

Claude will ask you everything it needs to know, then work through the build step by step.

---

### Option B: Individual skills

Use individual skills if you only need one part of the process, or want to do stages separately.

#### Plan your site

> "Plan my website. I run [business name], we [what you do] for [who]. The main goal is [leads / sales / bookings]."

You'll get a page list, site map, navigation structure, and build order.

---

#### Build the theme

> "Create a WordPress theme for [business name]. Primary colour: [hex]. Secondary colour: [hex]."

Claude generates all the theme files. Copy the theme folder into your Local WP themes directory:

- **Windows:** `C:\Users\[you]\Local Sites\[site]\app\public\wp-content\themes\`
- **Mac:** `~/Local Sites/[site]/app/public/wp-content/themes/`

Then activate it in WordPress under Appearance > Themes.

---

#### Build pages

> "Build me a [homepage / about page / services page / contact page / landing page] for [business description]. Primary CTA: [action]."

Claude generates the page template file. Copy it into your theme's `templates/` folder, create a matching page in WordPress, and assign the template under Page Attributes.

Set your homepage under Settings > Reading > A static page.

---

#### Write the copy

> "Write the copy for my [page name]. We're [business description]. Target customers: [who]. Main differentiator: [what makes you different]. CTA: [action]."

If you have a `voice-dna.md` file in your project folder, the voice pass will automatically write in your specific voice. If not, it will still improve the copy, just not tuned to your brand. See Step 2 to set up your Voice DNA.

Claude writes section-by-section copy and runs it through the superhuman-writer automatically. Paste the final copy into each page in WordPress.

---

#### SEO and AEO

The `seo-aeo` skill runs at three points. You can also use it standalone.

**After the site plan (structure analysis):**
> "Analyse my site plan for SEO. Here's the plan: [paste site-planner output]."

You'll get a topical authority assessment, page hierarchy check, internal linking map, URL slug recommendations, and any missing pages flagged by priority.

**Before writing copy (keyword planning):**
> "Keyword research for my site. Here are my pages: [list from site plan]."

Every page gets a primary keyword, intent classification, and 3-5 supporting keywords.

**After copy is written (on-page audit):**
> "SEO audit my copy. [paste or reference the copy files]."

Every page is scored out of 10. You get a fix list, schema markup for each page type, and an overall summary. Target is 8/10 minimum before launch.

---

#### Run the launch checklist

> "Give me a pre-launch checklist for my [business type] site. Pages: [list them]. Primary goal: [leads / sales / bookings]."

You'll get every check tagged as BLOCKER, IMPORTANT, or NICE-TO-HAVE. Fix all BLOCKERs before going live.

---

## Recommended Plugins

WordPress needs plugins to cover things the core software doesn't include. These are the types every site should have, with a couple of options per category.

| Type | Why You Need It | Options |
|---|---|---|
| SEO | Title tags, meta descriptions, schema markup, XML sitemaps | Rank Math (free), Yoast SEO (free) |
| Caching | Speeds up the site for real visitors | WP Rocket (paid), LiteSpeed Cache (free), W3 Total Cache (free) |
| Security | Blocks brute force, monitors file changes, protects login | Solid Security (free), Wordfence (free) |
| Forms | Contact forms, lead capture, enquiry forms | WPForms (free/paid), Contact Form 7 (free), Fluent Forms (free/paid) |
| Backups | Automated off-site backups before anything goes wrong | UpdraftPlus (free/paid), BackWPup (free) |
| Image optimisation | Compresses images automatically on upload | Smush (free/paid), ShortPixel (paid), Imagify (free/paid) |
| Cookie consent | Legal requirement in UK and EU if using analytics or tracking | CookieYes (free/paid), Complianz (free/paid) |

Install only what you need. Every plugin adds load time. A simple brochure site only needs SEO, security, backups, a forms plugin, and cookie consent.

The launch checklist will flag which types apply to your site.

---

## Step 4: Go Live

When the site is ready:

1. Buy a domain name (Namecheap, Cloudflare, or your preferred registrar)
2. Set up WordPress hosting: Cloudways (best performance), SiteGround (beginner-friendly), or Krystal (UK-based) all work well
3. In Local WP, right-click your site and choose **Export**
4. Import the ZIP to your hosting using UpdraftPlus (free) or Duplicator
5. Point your domain's DNS to your host
6. Install SSL (most hosts do this automatically)
7. Run a search-and-replace to update URLs from `yoursite.local` to `yourdomain.com`
8. Test the contact form, check the site on mobile, submit your sitemap to Google Search Console
9. Run the production security audit: say "Run a production security audit on my live site." This checks wp-config.php, .htaccess, exposed files, and security headers on your live server.
10. Push your theme folder to a private GitHub repository as a backup. If something breaks after a plugin update or edit, you can restore from there.

---

## Troubleshooting

**Theme not showing in Local WP**
Copy the theme folder into `wp-content/themes/`, then go to Appearance > Themes in WordPress and activate it. If it doesn't appear, check there are no spaces in the folder name and that `style.css` exists in the theme root.

**Contact form not sending emails**
Local WP doesn't send real emails. Install WP Mail SMTP and connect it to Gmail or Mailgun to test locally. Use it on your live site too for reliable delivery.

**Search engines blocked after launch**
Go to Settings > Reading and uncheck "Discourage search engines from indexing this site." This is the most common launch mistake. The launch checklist will flag it as a BLOCKER.

**Page template not appearing in WordPress**
Block themes: templates go in the `templates/` folder. Classic themes: templates go in the theme root with a template header comment. Assign the template under Page Attributes on the page.

**URLs still showing the local domain after migration**
Use the Better Search Replace plugin to find and replace `yoursite.local` with your live domain across the database. Run in dry-run mode first.

## Course-Correcting Mid-Build

You don't need to restart if something isn't right. Claude saves progress after every stage so you can fix specific parts without losing everything.

| Problem | What to Say |
|---|---|
| Wrong pages in the site plan | "Go back to the site plan. I want to add [page] and remove [page]." |
| Theme colours or fonts are off | "Regenerate the theme with these colours: [hex codes]." |
| A page template needs a different layout | "Rebuild the [page name] template. I want [describe the change]." |
| Copy for one page isn't right | "Rewrite the [page name] copy. [Describe what's wrong]." |
| The voice pass didn't sound right | "Run the voice pass again on [page name]. [Describe the tone issue]." |
| A page scored below 8 in the SEO audit | "Fix the SEO issues on [page name] and show me the updated copy." |

Claude will not move to the next stage without your confirmation. If something needs changing, say so before approving the stage.

---

## Credit

This pack was built by Zara Imrie at Clever Operators and shared free with the Ads to AI community. If you want to see more of her work, head to her site.

**Zara Imrie**
Founder, Clever Operators
Website: cleveroperators.com

---

*Built with Claude Code and the Website Builder Skill Pack by Clever Operators.*
