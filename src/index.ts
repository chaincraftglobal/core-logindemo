import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import validateRouter from "./routes/validate";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "core-logindemo" });
});

app.use("/validate", validateRouter);

const port = process.env.PORT || 8082;
app.listen(port, () => console.log(`[core-logindemo] running on port ${port}`));