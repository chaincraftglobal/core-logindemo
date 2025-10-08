import { Router, Request, Response } from "express";
import puppeteer, { type Browser, type LaunchOptions } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const router = Router();

// Detect if running on Render (production)
const isRender = () =>
    !!process.env.RENDER ||
    !!process.env.RENDER_EXTERNAL_URL ||
    process.env.NODE_ENV === "production";

// Launch options for Puppeteer
async function getLaunchOptions(): Promise<LaunchOptions> {
    const isProd = isRender();

    if (isProd) {
        // ✅ On Render: use Sparticuz Chromium
        const execPath = await chromium.executablePath();
        console.log("🧭 Using Chromium from:", execPath);

        return {
            args: chromium.args,
            executablePath: execPath,
            headless: true,
            ignoreDefaultArgs: ["--disable-extensions"],
        };
    }

    // ✅ Local development on Mac/Windows
    return {
        channel: "chrome",
        headless: false,
    };
}

// Main /validate route
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

            // Set viewport explicitly (no defaultViewport from chromium)
            await page.setViewport({ width: 1280, height: 800 });

            // Timeouts
            page.setDefaultNavigationTimeout(90_000);
            page.setDefaultTimeout(60_000);

            // Visit login page
            await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

            // Fill email
            await page.waitForSelector('input[name="email"], #email', { visible: true });
            await page.type('input[name="email"], #email', username, { delay: 25 });

            // Fill password
            await page.waitForSelector('input[name="password"], #password', { visible: true });
            await page.type('input[name="password"], #password', password, { delay: 25 });

            // Click Login button
            const submitSel =
                'button[type="submit"], .btn.btn-primary[type="submit"], .btn.btn-primary';
            await page.click(submitSel);

            // Wait for navigation
            await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 90_000 });

            // Evaluate result
            const currentUrl = page.url();
            const ok =
                currentUrl.includes("/home") ||
                (!currentUrl.includes("/login") && !currentUrl.includes("error"));

            // Take screenshot
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
                    // ignore silently
                }
            }
        }
    }
);

export default router;