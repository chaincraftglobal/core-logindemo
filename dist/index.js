"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const validate_1 = __importDefault(require("./routes/validate"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "2mb" }));
app.get("/", (_req, res) => {
    res.json({ ok: true, service: "core-logindemo" });
});
app.use("/validate", validate_1.default);
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(PORT, () => {
    console.log(`[core-logindemo] listening on ${PORT}`);
});
