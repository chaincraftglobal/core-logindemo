"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const router = express_1.default.Router();
router.post("/", async (req, res) => {
    const { loginUrl, username, password } = req.body;
    if (!loginUrl || !username || !password) {
        return res.status(400).json({
            ok: false,
            message: "loginUrl, username, and password are required.",
        });
    }
    let browser = null;
    try {
        // ✅ Launch Chrome using bundled Puppeteer
        browser = await puppeteer_1.default.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/119.0.0.0 Safari/537.36");
        // ✅ Visit login page
        await page.goto(loginUrl, {
            waitUntil: "networkidle2",
            timeout: 60000,
        });
        // ✅ Wait for form fields based on your HTML
        await page.waitForSelector('input#email[name="email"]', { visible: true });
        await page.waitForSelector('input#password[name="password"]', {
            visible: true,
        });
        // ✅ Fill login form
        await page.type('input#email[name="email"]', username, { delay: 30 });
        await page.type('input#password[name="password"]', password, { delay: 30 });
        // ✅ Click login button and wait for navigation
        await Promise.all([
            page.click('form[action*="/login"] button[type="submit"]'),
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
        ]);
        const currentUrl = page.url();
        const loggedIn = !/\/login/i.test(currentUrl);
        if (loggedIn) {
            const screenshot = await page.screenshot({ encoding: "base64" });
            return res.json({
                ok: true,
                message: "Authenticated successfully.",
                currentUrl,
                screenshot: `data:image/png;base64,${screenshot}`,
            });
        }
        else {
            const screenshot = await page.screenshot({ encoding: "base64" });
            return res.status(401).json({
                ok: false,
                message: "Login failed — still on login page.",
                screenshot: `data:image/png;base64,${screenshot}`,
                currentUrl,
            });
        }
    }
    catch (err) {
        return res.status(500).json({
            ok: false,
            message: err?.message || "Unexpected error during login.",
        });
    }
    finally {
        if (browser)
            await browser.close().catch(() => { });
    }
});
exports.default = router;
