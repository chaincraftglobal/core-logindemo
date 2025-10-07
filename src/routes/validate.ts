import { Router } from "express";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const router = Router();

router.post("/", async (req, res) => {
    const { loginUrl, username, password } = req.body;

    if (!loginUrl || !username || !password) {
        return res.status(400).json({ ok: false, message: "Missing fields" });
    }

    try {
        // ✅ Get Chrome executable path from Sparticuz Chromium
        const executablePath = await chromium.executablePath();

        if (!executablePath) {
            throw new Error("No Chromium executable found for Render environment");
        }

        const browser = await puppeteer.launch({
            args: chromium.args,
            executablePath,
            headless: true,
            defaultViewport: { width: 1280, height: 800 },
            ignoreHTTPSErrors: true, // still use it — we’ll cast this whole object
        } as any); // ✅ bypass TS complaining about that optional field

        const page = await browser.newPage();
        await page.goto(loginUrl, { waitUntil: "networkidle2", timeout: 60000 });

        await page.type("input[name='username'], #username", username);
        await page.type("input[name='password'], #password", password);

        await Promise.all([
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
            page.click("button[type='submit'], #loginBtn"),
        ]);

        const title = await page.title();
        await browser.close();

        if (!title.toLowerCase().includes("login")) {
            return res.json({ ok: true, message: "Authenticated successfully" });
        } else {
            return res.status(401).json({ ok: false, message: "Invalid credentials" });
        }
    } catch (err: any) {
        console.error("[Validate Error]", err);
        return res.status(500).json({
            ok: false,
            message: err.message || "Validation failed",
        });
    }
});

export default router;