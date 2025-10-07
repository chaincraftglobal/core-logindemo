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
    const executablePath = await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 800 }, // ✅ manually define viewport
      executablePath,
      headless: true, // ✅ safe default for Render
    });
    const page = await browser.newPage();

    // Navigate to the login page
    await page.goto(loginUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Fill in username & password fields (adjust selectors if needed)
    await page.type("input[name='username'], #username", username);
    await page.type("input[name='password'], #password", password);

    // Click the login button (adjust selector if needed)
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
      page.click("button[type='submit'], #loginBtn"),
    ]);

    const title = await page.title();
    await browser.close();

    // Simple check — if redirected or title changed, consider login successful
    if (!title.toLowerCase().includes("login")) {
      return res.json({ ok: true, message: "Authenticated" });
    } else {
      return res.status(401).json({ ok: false, message: "Invalid credentials" });
    }
  } catch (err: any) {
    console.error("[Validate Error]", err);
    return res
      .status(500)
      .json({ ok: false, message: err.message || "Validation failed" });
  }
});

export default router;
