import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { Request, Response } from "express";

type Body = {
    loginUrl: string;
    username: string;
    password: string;
};

const SELECTORS = {
    email: `input#email[name="email"]`,
    password: `input#password[name="password"]`,
    submit: `form[action*="/login"] button[type="submit"]`,
};

function isLoginUrl(url: string) {
    return /\/vp_interface\/login/i.test(url);
}

export default async function validateHandler(req: Request, res: Response) {
    const { loginUrl, username, password } = req.body as Body;

    if (!loginUrl || !username || !password) {
        return res.status(400).json({
            ok: false,
            message: "loginUrl, username and password are required",
        });
    }

    let browser: Browser | null = null;

    try {
        // Launch options for Render / serverless (Sparticuz Chromium) or local
        const executablePath =
            process.env.PUPPETEER_EXECUTABLE_PATH ||
            (await chromium.executablePath());

        browser = await puppeteer.launch({
            executablePath: executablePath || undefined,
            headless: true,
            args: [
                ...(chromium.args || []),
                "--no-sandbox",
                "--disable-setuid-sandbox",
            ],
        });

        const page = await browser.newPage();

        // A stable desktop UA sometimes helps with WAF/CDN pages
        await page.setUserAgent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        );

        // Go to login page
        await page.goto(loginUrl, { waitUntil: "networkidle2", timeout: 90_000 });

        // Wait for the email field (from your HTML)
        await page.waitForSelector(SELECTORS.email, {
            timeout: 30_000,
            visible: true,
        });

        // Type creds
        await page.click(SELECTORS.email, { clickCount: 3 });
        await page.type(SELECTORS.email, username, { delay: 20 });

        await page.click(SELECTORS.password, { clickCount: 3 });
        await page.type(SELECTORS.password, password, { delay: 20 });

        // Submit
        await page.waitForSelector(SELECTORS.submit, { timeout: 15_000 });
        await Promise.all([
            page.click(SELECTORS.submit),
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 90_000 }),
        ]);

        const urlAfter = page.url();

        // Heuristics for success:
        // - not on the login page anymore OR
        // - a basic post-login marker (customize as needed)
        const looksLoggedIn =
            !isLoginUrl(urlAfter) ||
            (await page
                .evaluate(() => {
                    // add quick markers you expect post-login
                    const logoutLink =
                        document.querySelector("a[href*='logout']") ||
                        document.querySelector("form[action*='logout']");
                    const dashboard =
                        document.querySelector("#dashboard") ||
                        document.querySelector("[data-page='dashboard']");
                    return Boolean(logoutLink || dashboard);
                })
                .catch(() => false));

        if (looksLoggedIn) {
            return res.json({ ok: true, message: "Authenticated successfully." });
        }

        // Not logged in — capture a screenshot for debugging
        const shot = (await page.screenshot({ encoding: "base64" })) as string;
        return res.status(400).json({
            ok: false,
            message: "Login did not navigate away from the login page.",
            screenshot: `data:image/png;base64,${shot}`,
            currentUrl: urlAfter,
        });
    } catch (err: any) {
        return res.status(500).json({
            ok: false,
            message: err?.message || "Login validation failed",
        });
    } finally {
        if (browser) await browser.close().catch(() => { });
    }
}