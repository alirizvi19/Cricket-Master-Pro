import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API router
  const apiRouter = express.Router();

  // Gemini API for Commentary
  apiRouter.post("/commentary", async (req, res) => {
    try {
      const { prompt } = req.body;
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        return res.status(500).json({ error: "Gemini API key is required" });
      }

      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      res.json({ commentary: response.text });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate commentary" });
    }
  });

  apiRouter.post("/summary", async (req, res) => {
    try {
      const { matchData } = req.body;
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        return res.status(500).json({ error: "Gemini API key is required" });
      }

      const prompt = `You are an expert cricket commentator. Generate an exciting, professional post-match summary based on the following match data:\n\n${JSON.stringify(matchData, null, 2)}\n\nInclude highlights, key performances, and the final result. Keep it engaging.`;

      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      res.json({ summary: response.text });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate summary" });
    }
  });

  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
