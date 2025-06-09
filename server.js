import express from 'express';
import multer from 'multer';
import cors from 'cors';
import csv from 'csv-parser';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? true : "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// AI Model configurations
const AI_MODELS = {
  'gpt-4.1': { provider: 'openai', model: 'gpt-4-turbo' },
  'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
  'gpt-o3': { provider: 'openai', model: 'o3-mini' },
  'claude-3.7': { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
  'claude-sonnet-4': { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
  'claude-opus-4': { provider: 'anthropic', model: 'claude-3-opus-20240229' },
  'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' },
  'deepseek-coder': { provider: 'deepseek', model: 'deepseek-coder' }
};

// Initialize AI clients
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper function to call different AI models
async function callAIModel(modelKey, prompt, retries = 3) {
  const config = AI_MODELS[modelKey];

  // Check if API keys are available
  if (config.provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  if (config.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }
  if (config.provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API key not configured');
  }

  try {
    switch (config.provider) {
      case 'openai':
        const openaiResponse = await openai.chat.completions.create({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
        });
        return openaiResponse.choices[0].message.content;

      case 'anthropic':
        const anthropicResponse = await anthropic.messages.create({
          model: config.model,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        });
        return anthropicResponse.content[0].text;

      case 'deepseek':
        const deepseekResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        return deepseekResponse.data.choices[0].message.content;

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying ${modelKey}, attempts left: ${retries - 1}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return callAIModel(modelKey, prompt, retries - 1);
    }
    throw error;
  }
}

// Parse CSV file
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Generate Excel file
function generateExcel(data, outputPath) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Recommendations');
  XLSX.writeFile(workbook, outputPath);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// API Routes
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { selectedModels, iterations, socketId } = req.body;

    if (!selectedModels) {
      return res.status(400).json({ error: 'No models selected' });
    }

    let models;
    try {
      models = JSON.parse(selectedModels);
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid models format' });
    }

    if (!Array.isArray(models) || models.length === 0) {
      return res.status(400).json({ error: 'At least one model must be selected' });
    }

    const iterationCount = parseInt(iterations) || 1;

    // Parse CSV
    const csvData = await parseCSV(req.file.path);
    
    // Process recommendations
    const results = [];
    const totalTasks = csvData.length * models.length * iterationCount;
    let completedTasks = 0;

    // Emit initial progress
    io.emit('progress', {
      completed: 0,
      total: totalTasks,
      percentage: 0,
      currentProduct: '',
      currentModel: '',
      status: 'Starting processing...'
    });

    for (const row of csvData) {
      const productInfo = Object.values(row).join(', ');
      const prompt = `Based on this product: "${productInfo}", provide 3-5 specific product recommendations with brief explanations. Focus on similar or complementary products that customers who buy this item might also be interested in. Include product names and short reasons for each recommendation.`;

      for (const modelKey of models) {
        for (let i = 0; i < iterationCount; i++) {
          // Emit progress update
          io.emit('progress', {
            completed: completedTasks,
            total: totalTasks,
            percentage: Math.round((completedTasks / totalTasks) * 100),
            currentProduct: productInfo,
            currentModel: modelKey,
            iteration: i + 1,
            status: `Processing ${productInfo} with ${modelKey} (iteration ${i + 1}/${iterationCount})`
          });

          try {
            const recommendation = await callAIModel(modelKey, prompt);
            results.push({
              'Original Product': productInfo,
              'Model': modelKey,
              'Iteration': i + 1,
              'Recommendation': recommendation,
              'Timestamp': new Date().toISOString()
            });
            completedTasks++;

            console.log(`Progress: ${completedTasks}/${totalTasks}`);
          } catch (error) {
            console.error(`Error with ${modelKey} iteration ${i + 1}:`, error.message);
            results.push({
              'Original Product': productInfo,
              'Model': modelKey,
              'Iteration': i + 1,
              'Recommendation': `Error: ${error.message}`,
              'Timestamp': new Date().toISOString()
            });
            completedTasks++;
          }
        }
      }
    }

    // Emit completion
    io.emit('progress', {
      completed: totalTasks,
      total: totalTasks,
      percentage: 100,
      status: 'Processing complete! Generating Excel file...'
    });

    // Generate Excel file
    const outputFileName = `recommendations_${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, 'outputs', outputFileName);
    
    // Ensure outputs directory exists
    if (!fs.existsSync(path.join(__dirname, 'outputs'))) {
      fs.mkdirSync(path.join(__dirname, 'outputs'));
    }

    generateExcel(results, outputPath);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      downloadUrl: `/api/download/${outputFileName}`,
      totalRecommendations: results.length
    });

  } catch (error) {
    console.error('Processing error:', error);

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    // Ensure we always return JSON
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message || 'An unexpected error occurred',
        success: false
      });
    }
  }
});

// Check API key status
app.get('/api/status', (_req, res) => {
  const status = {
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY
  };

  const availableModels = Object.entries(AI_MODELS).filter(([_key, config]) => {
    return status[config.provider];
  }).map(([modelKey]) => modelKey);

  res.json({
    apiKeys: status,
    availableModels,
    totalModels: Object.keys(AI_MODELS).length
  });
});

app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'outputs', filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Serve React app for all other routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('WebSocket server enabled');
  console.log('Make sure to set your API keys in .env file:');
  console.log('- OPENAI_API_KEY');
  console.log('- ANTHROPIC_API_KEY');
  console.log('- DEEPSEEK_API_KEY');
});
