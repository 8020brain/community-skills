#!/usr/bin/env node

/**
 * Landing Page Audit - Screenshot Capture
 *
 * Takes multiple viewport screenshots of a landing page:
 * - Desktop above-fold (1440x900)
 * - Desktop full page (limited to 4000px height)
 * - Mobile above-fold (375x812)
 * - Mobile full page (limited to 4000px height)
 *
 * Usage:
 *   node screenshot.cjs <url> --output <folder>
 *   node screenshot.cjs https://example.com --output ./screenshots
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const MAX_HEIGHT = 4000; // Maximum screenshot height for desktop
const MOBILE_SECTION_HEIGHT = 3000; // Height for each mobile section (for side-by-side PDF display)
const DESKTOP_WIDTH = 1440;
const DESKTOP_HEIGHT = 900;
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;
const TIMEOUT = 30000;

async function captureScreenshots(url, outputFolder) {
    console.log(`\nCapturing screenshots for: ${url}`);
    console.log(`Output folder: ${outputFolder}\n`);

    // Create output folder
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    const browser = await chromium.launch({ headless: true });
    const results = [];

    try {
        // === Desktop Screenshots ===
        console.log('Capturing desktop views...');

        const desktopContext = await browser.newContext({
            viewport: { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT }
        });
        const desktopPage = await desktopContext.newPage();

        await desktopPage.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await desktopPage.waitForTimeout(2000);

        // Scroll to trigger lazy loading
        await triggerLazyLoad(desktopPage);

        // Desktop above-fold
        const desktopFoldPath = path.join(outputFolder, 'desktop-fold.png');
        await desktopPage.screenshot({ path: desktopFoldPath });
        console.log(`  Saved: desktop-fold.png`);
        results.push({ type: 'desktop-fold', path: desktopFoldPath });

        // Desktop full page (height limited)
        const desktopFullPath = path.join(outputFolder, 'desktop-full.png');
        const desktopScrollHeight = await desktopPage.evaluate(() => document.body.scrollHeight);

        if (desktopScrollHeight > MAX_HEIGHT) {
            // Capture with clip to limit height
            await desktopPage.screenshot({
                path: desktopFullPath,
                clip: { x: 0, y: 0, width: DESKTOP_WIDTH, height: MAX_HEIGHT }
            });
            console.log(`  Saved: desktop-full.png (clipped to ${MAX_HEIGHT}px)`);
        } else {
            await desktopPage.screenshot({ path: desktopFullPath, fullPage: true });
            console.log(`  Saved: desktop-full.png (full page: ${desktopScrollHeight}px)`);
        }
        results.push({ type: 'desktop-full', path: desktopFullPath, height: Math.min(desktopScrollHeight, MAX_HEIGHT) });

        await desktopContext.close();

        // === Mobile Screenshots ===
        console.log('Capturing mobile views...');

        const mobileContext = await browser.newContext({
            viewport: { width: MOBILE_WIDTH, height: MOBILE_HEIGHT },
            isMobile: true,
            hasTouch: true
        });
        const mobilePage = await mobileContext.newPage();

        await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });
        await mobilePage.waitForTimeout(2000);

        // Scroll to trigger lazy loading
        await triggerLazyLoad(mobilePage);

        // Mobile above-fold
        const mobileFoldPath = path.join(outputFolder, 'mobile-fold.png');
        await mobilePage.screenshot({ path: mobileFoldPath });
        console.log(`  Saved: mobile-fold.png`);
        results.push({ type: 'mobile-fold', path: mobileFoldPath });

        // Mobile screenshots - capture in two sections for side-by-side PDF display
        const mobileScrollHeight = await mobilePage.evaluate(() => document.body.scrollHeight);

        // Resize viewport to full page height so we can capture any section
        await mobilePage.setViewportSize({ width: MOBILE_WIDTH, height: mobileScrollHeight });
        await mobilePage.waitForTimeout(500); // Let layout settle

        // Mobile top section (0 to MOBILE_SECTION_HEIGHT)
        const mobileTopPath = path.join(outputFolder, 'mobile-top.png');
        const topHeight = Math.min(mobileScrollHeight, MOBILE_SECTION_HEIGHT);
        await mobilePage.screenshot({
            path: mobileTopPath,
            clip: { x: 0, y: 0, width: MOBILE_WIDTH, height: topHeight }
        });
        console.log(`  Saved: mobile-top.png (${topHeight}px)`);
        results.push({ type: 'mobile-top', path: mobileTopPath, height: topHeight });

        // Mobile bottom section (MOBILE_SECTION_HEIGHT onwards) - only if page is tall enough
        if (mobileScrollHeight > MOBILE_SECTION_HEIGHT) {
            const mobileBottomPath = path.join(outputFolder, 'mobile-bottom.png');
            const bottomHeight = Math.min(mobileScrollHeight - MOBILE_SECTION_HEIGHT, MOBILE_SECTION_HEIGHT);
            await mobilePage.screenshot({
                path: mobileBottomPath,
                clip: { x: 0, y: MOBILE_SECTION_HEIGHT, width: MOBILE_WIDTH, height: bottomHeight }
            });
            console.log(`  Saved: mobile-bottom.png (${bottomHeight}px from ${MOBILE_SECTION_HEIGHT}px)`);
            results.push({ type: 'mobile-bottom', path: mobileBottomPath, height: bottomHeight, offsetY: MOBILE_SECTION_HEIGHT });
        }

        await mobileContext.close();

        // Get page title
        const titleContext = await browser.newContext();
        const titlePage = await titleContext.newPage();
        await titlePage.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        const pageTitle = await titlePage.title();
        await titleContext.close();

        // Save metadata
        const metadata = {
            url,
            pageTitle,
            capturedAt: new Date().toISOString(),
            screenshots: results,
            config: {
                maxHeight: MAX_HEIGHT,
                desktopViewport: `${DESKTOP_WIDTH}x${DESKTOP_HEIGHT}`,
                mobileViewport: `${MOBILE_WIDTH}x${MOBILE_HEIGHT}`
            }
        };

        const metadataPath = path.join(outputFolder, 'screenshots.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        console.log(`\nMetadata saved: screenshots.json`);

        return metadata;

    } finally {
        await browser.close();
    }
}

async function triggerLazyLoad(page) {
    await page.evaluate(async () => {
        await new Promise(resolve => {
            let totalHeight = 0;
            const distance = 500;
            const timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= document.body.scrollHeight) {
                    clearInterval(timer);
                    window.scrollTo(0, 0);
                    resolve();
                }
            }, 100);
        });
    });
    await page.waitForTimeout(1000);
}

// Main
async function main() {
    const args = process.argv.slice(2);

    let url = null;
    let outputFolder = './screenshots';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--output' || args[i] === '-o') {
            outputFolder = args[++i];
        } else if (args[i].startsWith('http')) {
            url = args[i];
        }
    }

    if (!url) {
        console.error('Usage: node screenshot.cjs <url> --output <folder>');
        console.error('\nExample:');
        console.error('  node screenshot.cjs https://example.com --output ./screenshots');
        process.exit(1);
    }

    try {
        const result = await captureScreenshots(url, outputFolder);
        console.log('\n' + '='.repeat(50));
        console.log('Screenshots captured successfully!');
        console.log(`Page: ${result.pageTitle}`);
        console.log(`Files saved to: ${outputFolder}`);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
