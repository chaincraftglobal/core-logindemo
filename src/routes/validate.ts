import { Router, Request, Response } from "express";
import puppeteer, { type Browser, type LaunchOptions } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const router = Router();

const isRender = () =>
    !!process.env.RENDER ||
    !!process.env.RENDER_EXTERNAL_URL ||
    process.env.NODE_ENV === "production";

async function getLaunchOptions(): Promise<LaunchOptions> {
    if (isRender()) {
        // 🟢 Render server: use @sparticuz/chromium (bundled headless Chrome)
        return {
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true, // must be boolean, not chromium.headless
        };
    }

    // 🟡 Local development: use system Chrome
    return {
        channel: "chrome",
        headless: false,
    };
}

router.post(
    "/validate",
    async (req: Request, res: Response): Promise<Response> => {
        const { loginUrl, username, password } = req.body ?? {};

        if (!loginUrl || !username || !password) {
            return res
                .status(400)
                .json({ ok: false, message: "loginUrl, username, and password are required" });
        }

        let browser: Browser | null = null;

        try {
            const launchOptions = await getLaunchOptions();
            browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();

            // Explicit viewport (since chromium.defaultViewport removed)
            await page.setViewport({ width: 1280, height: 800 });

            page.setDefaultNavigationTimeout(90_000);
            page.setDefaultTimeout(60_000);

            // Go to login page
            await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

            // Input email
            await page.waitForSelector('input[name="email"], #email', { visible: true });
            await page.type('input[name="email"], #email', username, { delay: 20 });

            // Input password
            await page.waitForSelector('input[name="password"], #password', { visible: true });
            await page.type('input[name="password"], #password', password, { delay: 20 });

            // Click login button
            const submitSel =
                'button[type="submit"], .btn.btn-primary[type="submit"], .btn.btn-primary';
            await page.click(submitSel);

            // Wait for redirect after login
            await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 90_000 });

            const currentUrl = page.url();
            const ok =
                currentUrl.includes("/home") || !currentUrl.includes("/login");

            const png = await page.screenshot({ type: "png" });
            const screenshot = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;

            return res.json({
                ok,
                message: ok
                    ? "Authenticated successfully."
                    : "Login may have failed; check currentUrl.",
                currentUrl,
                screenshot,
            });
        } catch (err: any) {
            return res.status(500).json({
                ok: false,
                message: err?.message || "Unexpected error",
                currentUrl: null,
            });
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch {
                    // ignore
                }
            }
        }
    }
);

export default router;