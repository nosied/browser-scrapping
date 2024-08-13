import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import pLimit from 'p-limit';

const app = express();
const port = 6006;
const queue = [];
const MAX_CONCURRENT_REQUESTS = 10; // Limite de requisições simultâneas
let pendingRequests = 0; // Contador de requisições pendentes

// Criar uma instância do limitador com o número máximo de requisições simultâneas
const limit = pLimit(MAX_CONCURRENT_REQUESTS);

app.use(cors());

// Endpoint para obter o número de requisições pendentes
app.get("/api/pending-requests", (req, res) => {
  res.json({ pendingRequests });
});

app.get("/api/render", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    console.log('Error: URL is required');
    return res.status(400).json({ error: "URL is required" });
  }

  const requestId = Date.now(); // Usar timestamp como ID único para log
  console.log(`Received request with ID: ${requestId}`);

  // Incrementar o contador de requisições pendentes
  pendingRequests++;
  console.log(`Pending requests count: ${pendingRequests}`);

  const job = async () => {
    try {
      console.log('Processing request with ID:', requestId);
      const content = await processRequest(url);
      console.log(`Request with ID: ${requestId} processed successfully`);
      return content;
    } catch (error) {
      console.error(`Request with ID: ${requestId} failed with error: ${error.message}`);
      throw error;
    } finally {
      // Decrementar o contador de requisições pendentes
      pendingRequests--;
      console.log(`Pending requests count: ${pendingRequests}`);
    }
  };

  try {
    // Adicionar o trabalho à fila e limitar a execução simultânea
    const result = await limit(() => job());
    
    res.json({ 
      message: "Página renderizada com sucesso",
      content: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const processRequest = async (url) => {
  // Lançar o Puppeteer com as opções --no-sandbox e --disable-setuid-sandbox
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  const content = await page.content();
  await browser.close();
  return content;
};

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
