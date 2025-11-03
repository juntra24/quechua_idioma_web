import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));


app.get("/chat", (req, res) => {
  res.send("Servidor activo");
});

app.post("/chat", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        prompt: `Eres un asistente amigable para aprender quechua. Responde: ${prompt}`
      })
    });
    
    if (!response.ok) {
      throw new Error('Error conectando con Ollama');
    }
    
    const data = await response.text();
    res.send(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error: ' + error.message);
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
  console.log('Asegúrate de ejecutar "ollama run llama3" en otra terminal');
});
