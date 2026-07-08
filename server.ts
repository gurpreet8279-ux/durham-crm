import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/process-logs', async (req, res) => {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text input is required.' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are an expert data assistant specializing in CRM data entry, text parsing, and data cleaning for a mobile automotive detailing business. 

Your job is to take messy, unformatted, or OCR-scraped text data representing client logs and convert them into a perfectly structured, clean Markdown table.

Follow these strict data-cleaning rules:
1. Extract the following columns: Date, Customer Name, Phone Number, Vehicle(s), Price / Notes, Address, City/Town.
2. If a phone number is split across lines or missing digits, reconstruct it into standard (XXX) XXX-XXXX formatting.
3. Clean up truncated vehicle names where possible (e.g., change "Chevy Trail" to "Chevy Trailblazer", "Ford Escap" to "Ford Escape").
4. Isolate the City/Town from the street address and place it into its own dedicated column (e.g., Whitby, Oshawa, Ajax, Pickering, Bowmanville, Courtice).
5. If data is missing (like a phone number, price, or name), explicitly write "*Missing*" or use a clear placeholder like "--".
6. Group multi-car bookings clearly if they share the same name, date, or phone number.

FOLLOW-UP CONFIRMATION MESSAGE GENERATION:
For every unique customer found in the log, generate a short, polite, and professional follow-up text message template that the business owner can send to confirm their completion or thank them. 
- Use the format: "Hey [Name], thanks for choosing Durham's Crown Mobile Detailing! Your [Vehicle] is all set. We appreciate your business! 👑"
- If the price is available, include it: "Total: [Price]"
- Keep it concise, friendly, and professional.

Do not include conversational filler in your final output. Respond directly with the formatted table, followed by a header titled "### 📱 Client Follow-Up Confirmation Messages".

Here is the messy text to process:
\n\n${text}\n\n`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      res.json({ result: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || 'Failed to process data' });
    }
  });

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
    // Express 4 wildcard syntax
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
