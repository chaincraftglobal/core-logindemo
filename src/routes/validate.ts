import { Router } from "express";
import puppeteer from "puppeteer";

const router = Router();

router.post("/", async (req, res) => {
    const { loginUrl, username, password } = req.body;
    const targetUrl = loginUrl || process.env.EVP_LOGIN_URL;

    if (!targetUrl || !username || !password) {
        return res.status(400).json({ ok: false, message: "Missing login details" });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

        await page.type("input[name='username']", username, { delay: 40 });
        await page.type("input[name='password']", password, { delay: 40 });

        await Promise.all([
            page.click("button[type='submit']"),
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
        ]);

        const url = page.url();
        const success =
            !url.includes("login") &&
            (url.includes("dashboard") || url.includes("transactions"));

        res.json({
            ok: success,
            message: success
                ? "✅ Login success"
                : `❌ Login failed or stuck at ${url}`,
            currentUrl: url,
        });
    } catch (err: any) {
        res.status(500).json({ ok: false, message: err.message });
    } finally {
        if (browser) await browser.close();
    }
});

export default router;