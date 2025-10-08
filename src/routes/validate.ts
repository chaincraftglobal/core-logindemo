import { Router } from "express";
import puppeteer, { Browser, Page, LaunchOptions } from "puppeteer";

type ReqBody = {
    loginUrl: string;
    username: string;
    password: string;
};

const router = Router();

router.post("/", async (req, res) => {
    const { loginUrl, username, password } = (req.body || {}) as ReqBody;

    if (!loginUrl || !username || !password) {
        return res.status(400).json({
            ok: false,
            message: "Missing loginUrl, username, or password"
        });
    }

    let browser: Browser | null = null;

    try {
        // Launch with Chrome channel; works locally and on Render (postinstall installs Chrome).
        browser = await puppeteer.launch({
            channel: "chrome",
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        });

        const page = await browser.newPage();

        // Speed/reliability tweaks
        page.setDefaultNavigationTimeout(90_000);
        page.setDefaultTimeout(60_000);

        await page.goto(loginUrl, { waitUntil: "networkidle2" });

        // The site uses name="email" and name="password"
        await page.waitForSelector('input[name="email"]', { visible: true });
        await page.type('input[name="email"]', username, { delay: 15 });

        await page.waitForSelector('input[name="password"]', { visible: true });
        await page.type('input[name="password"]', password, { delay: 18 });

        // Try clicking the visible submit button inside the same form
        // If the site changes, you can also submit via form submit() as fallback.
        const submitBtn = await page.$('form button[type="submit"], button[type="submit"], .btn.btn-primary[type="submit"]');
        if (submitBtn) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: "networkidle2" }),
                submitBtn.click()
            ]);
        } else {
            // Fallback: submit the first form on the page
            await Promise.all([
                page.waitForNavigation({ waitUntil: "networkidle2" }),
                page.evaluate(() => {
                    const form = document.querySelector("form") as HTMLFormElement | null;
                    if (form) form.submit();
                })
            ]);
        }

        const currentUrl = page.url();

        // Decide success by URL pattern (their dashboard URL)
        const ok = /\/home($|[\?#])/.test(currentUrl) || /dashboard/i.test(currentUrl);

        // Always include a screenshot for debugging
        const png = await page.screenshot({ type: "png", fullPage: true });
        const screenshot = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;

        if (!ok) {
            return res.json({
                ok: false,
                message: "Login failed or unexpected destination.",
                currentUrl,
                screenshot
            });
        }

        // (Optional) place to scrape post-login data if you need it later
        // const someText = await page.$eval(".some-selector", el => el.textContent?.trim());

        return res.json({
            ok: true,
            message: "Authenticated successfully.",
            currentUrl,
            screenshot
        });
    } catch (err: any) {
        return res.status(500).json({
            ok: false,
            message: err?.message || "Unhandled error",
            currentUrl: null
        });
    } finally {
        if (browser) {
            try { await browser.close(); } catch { }
        }
    }
});

export default router;