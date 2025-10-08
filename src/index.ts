import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import validateRouter from "./routes/validate";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
    res.json({ ok: true, service: "core-logindemo" });
});

app.use("/validate", validateRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(PORT, () => {
    console.log(`[core-logindemo] listening on ${PORT}`);
});