"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const chromium_1 = __importDefault(require("@sparticuz/chromium"));
const router = (0, express_1.Router)();
const isRender = () => !!process.env.RENDER ||
    !!process.env.RENDER_EXTERNAL_URL ||
    process.env.NODE_ENV === "production";
async function getLaunchOptions() {
    if (isRender()) {
        // 🟢 Render server: use @sparticuz/chromium (bundled headless Chrome)
        return {
            args: chromium_1.default.args,
            executablePath: await chromium_1.default.executablePath(),
            headless: true, // must be boolean, not chromium.headless
        };
    }
    // 🟡 Local development: use system Chrome
    return {
        channel: "chrome",
        headless: false,
    };
}
router.post("/validate", async (req, res) => {
    const { loginUrl, username, password } = req.body ?? {};
    if (!loginUrl || !username || !password) {
        return res
            .status(400)
            .json({ ok: false, message: "loginUrl, username, and password are required" });
    }
    let browser = null;
    try {
        const launchOptions = await getLaunchOptions();
        browser = await puppeteer_core_1.default.launch(launchOptions);
        const page = await browser.newPage();
        // Explicit viewport (since chromium.defaultViewport removed)
        await page.setViewport({ width: 1280, height: 800 });
        page.setDefaultNavigationTimeout(90000);
        page.setDefaultTimeout(60000);
        // Go to login page
        await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
        // Input email
        await page.waitForSelector('input[name="email"], #email', { visible: true });
        await page.type('input[name="email"], #email', username, { delay: 20 });
        // Input password
        await page.waitForSelector('input[name="password"], #password', { visible: true });
        await page.type('input[name="password"], #password', password, { delay: 20 });
        // Click login button
        const submitSel = 'button[type="submit"], .btn.btn-primary[type="submit"], .btn.btn-primary';
        await page.click(submitSel);
        // Wait for redirect after login
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 90000 });
        const currentUrl = page.url();
        const ok = currentUrl.includes("/home") || !currentUrl.includes("/login");
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
    }
    catch (err) {
        return res.status(500).json({
            ok: false,
            message: err?.message || "Unexpected error",
            currentUrl: null,
        });
    }
    finally {
        if (browser) {
            try {
                await browser.close();
            }
            catch {
                // ignore
            }
        }
    }
});
exports.default = router;
