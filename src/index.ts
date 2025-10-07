import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import validateRoute from "./routes/validate";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (_req, res) => res.json({ ok: true, service: "core-logindemo" }));

// Add login-check endpoint
app.use("/validate", validateRoute);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[core-logindemo] running on ${PORT}`));
