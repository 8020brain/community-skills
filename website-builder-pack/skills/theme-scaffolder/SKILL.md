---
name: theme-scaffolder
description: "Creates a WordPress theme from scratch for Local WP development. Generates all required theme files: style.css, theme.json (block themes) or functions.php (classic themes), templates, and template parts. Takes business name, colours, fonts, and theme type as input. Use when someone wants to start building a WordPress theme, set up their theme files, or create the foundation for a new site in Local WP."
---

# Theme Scaffolder

Creates a complete WordPress theme skeleton ready to install in Local WP. Outputs all the files needed to activate the theme and start building pages.

## What You Need From the User

Ask for anything not already provided:

1. **Theme type** - Block theme (default) or classic theme
2. **Business name** - used for theme name and branding
3. **Colours** - primary, secondary, and accent colour hex codes (offer sensible defaults if not provided)
4. **Fonts** - heading and body font preferences (default to system fonts for speed)
5. **Layout** - full-width or boxed content area

## Process

### For Block Themes (Default)

Generate these files:

**Required:**
- `style.css` - theme metadata header only (no layout CSS, that lives in theme.json)
- `theme.json` - design tokens: colours, typography, spacing, layout widths, editor UI settings
- `templates/index.html` - fallback template with header, content area, footer
- `parts/header.html` - site header with logo placeholder and navigation
- `parts/footer.html` - site footer with copyright and links

**Recommended:**
- `templates/page.html` - standard page template
- `templates/single.html` - single post template
- `templates/404.html` - not found page
- `templates/home.html` - front page template (if different from index)
- `functions.php` - only for enqueuing custom assets and registering block styles
- `patterns/` - at least one starter pattern (hero section)

### theme.json Structure

Always include:

```json
{
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  "version": 3,
  "settings": {
    "color": {
      "palette": [
        { "slug": "primary", "color": "#...", "name": "Primary" },
        { "slug": "secondary", "color": "#...", "name": "Secondary" },
        { "slug": "accent", "color": "#...", "name": "Accent" },
        { "slug": "background", "color": "#...", "name": "Background" },
        { "slug": "foreground", "color": "#...", "name": "Foreground" }
      ],
      "custom": false,
      "customGradient": false
    },
    "typography": {
      "fontFamilies": [],
      "customFontSize": false
    },
    "layout": {
      "contentSize": "800px",
      "wideSize": "1200px"
    },
    "spacing": {
      "units": ["px", "rem", "%"]
    }
  }
}
```

Lock down custom colours, gradients, and font sizes by default. This prevents clients from breaking the design in the editor.

### For Classic Themes

Generate these files:

- `style.css` - theme metadata header plus base styles
- `functions.php` - theme setup, menu registration, widget areas, asset enqueuing
- `index.php` - main template
- `header.php` - site header with `wp_head()`
- `footer.php` - site footer with `wp_footer()`
- `page.php` - standard page template
- `single.php` - single post template
- `404.php` - not found page
- `screenshot.txt` - placeholder note (replace with actual screenshot later)

### Coding Standards

All generated code must follow:

- **Escaping:** All output uses `esc_html()`, `esc_url()`, `esc_attr()` as appropriate
- **Sanitization:** All input data sanitized before use. `sanitize_text_field()` for text, `absint()` for integers, `sanitize_email()` for emails
- **Direct file access:** Every PHP file starts with `if ( ! defined( 'ABSPATH' ) ) exit;`
- **Nonces:** Any form that processes data includes a nonce field (`wp_nonce_field()`) and validates it on submission (`wp_verify_nonce()`)
- **No dangerous functions:** Never use `eval()`, `exec()`, `system()`, `shell_exec()`, or `passthru()`
- **Database queries:** Any direct database queries use `$wpdb->prepare()`. Never interpolate variables directly into SQL.
- **Translation:** All user-facing strings wrapped in `__()` or `esc_html__()`
- **Prefixing:** All functions prefixed with theme slug (e.g., `theme_name_setup()`)
- **Enqueuing:** Scripts and styles loaded via `wp_enqueue_scripts` hook, never hardcoded
- **No closing PHP tag** at end of PHP files
- **Indentation:** Tabs, not spaces (WordPress standard)

### Placeholder Handling

Use clear placeholders the user can find and replace:

- `[LOGO]` - where to add their logo
- `[TAGLINE]` - where to add their tagline
- `[PHONE]` - contact number
- `[EMAIL]` - contact email
- `[ADDRESS]` - business address
- `[YEAR]` - current year (use PHP `date('Y')` in classic themes)

## Output Format

Present files in order. For each file, show:

1. File path relative to theme root (e.g., `theme-name/style.css`)
2. Complete file contents

After all files, include:

```
## Installation

1. Copy the `[theme-name]` folder to your Local WP site:
   `C:\Users\[you]\Local Sites\[site]\app\public\wp-content\themes\`
2. In WordPress admin, go to Appearance > Themes
3. Activate [Theme Name]
4. Go to Appearance > Editor to start customising (block theme)
   OR go to Appearance > Customise (classic theme)

## What to Do Next

1. Replace placeholder text ([LOGO], [TAGLINE], etc.)
2. Add your logo via the Site Editor (block) or Customiser (classic)
3. Create your pages using the page-builder skill
4. Set your homepage: Settings > Reading > A static page
```

## Tone

- Direct and practical
- Explain what each file does in a brief comment, not a tutorial
- Code should be clean, minimal, and production-ready
- Do not over-engineer. Start simple, add complexity only when asked

## Important

- Default to block theme unless the user specifically asks for classic
- Keep theme.json locked down. Fewer options for the client means fewer ways to break the design
- Use system font stack by default for performance. Only add Google Fonts if the user specifies them
- Never include jQuery unless explicitly needed
- Never add placeholder "Lorem ipsum" content. Use short descriptive text like "Your headline here" or leave blocks empty

