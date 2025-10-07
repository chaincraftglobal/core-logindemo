import { Router } from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const router = Router();

router.post("/", async (req, res) => {
    const { loginUrl, username, password } = req.body;

    if (!loginUrl || !username || !password) {
        return res.status(400).json({ ok: false, message: "Missing fields" });
    }

    try {
        // ✅ Detect environment (Render or local)
        const isRender = process.env.RENDER === "true" || !!process.env.RENDER_EXTERNAL_URL;

        let executablePath: string | null;

        if (isRender) {
            // 🧠 On Render — use Sparticuz Chromium
            executablePath = await chromium.executablePath();
            if (!executablePath) throw new Error("Chromium executable not found for Render.");
        } else {
            // 🧩 Local — use system Chrome (Mac/Linux)
            executablePath =
                process.env.PUPPETEER_EXECUTABLE_PATH ||
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
        }

        console.log(`[LoginDemo] Launching Chrome from: ${executablePath}`);

        const browser = await puppeteer.launch({
            args: chromium.args,
            executablePath,
            headless: true,
            defaultViewport: { width: 1280, height: 800 },
        } as any);

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