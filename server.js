import express from 'express';
import multer from 'multer';
import cors from 'cors';
import csv from 'csv-parser';
import XLSX from 'xlsx';
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

// Configure multer for file uploads (memory storage for serverless)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

function generateDemoResponse(prompt, modelKey) {
  const productMatch = prompt.match(/What are the top 5 brands for (.+?)\?/);
  const product = productMatch ? productMatch[1] : 'Unknown Product';

  const demoResponses = {
    'gpt-4.1': [
      `BrandA, BrandB, BrandC, BrandD, BrandE`,
      `BrandX, BrandY, BrandZ, BrandAlpha, BrandBeta`
    ],
    'gpt-4o': [
      `Brand1, Brand2, Brand3, Brand4, Brand5`
    ],
    'gpt-o3': [
      `EcoBrand, MegaTools, SafeWare, UltraTech, HomePro`
    ],
    'claude-3.7': [
      `PrecisionX, GreenLine, NovaBuilt, Zenith, CoreCraft`
    ],
    'claude-sonnet-4': [
      `PrimeCraft, TechEdge, Endura, MaxHaus, VisionPro`
    ],
    'claude-opus-4': [
      `Artisan+, Vertex, OmegaCo, Nexa, Futura`
    ],
    'deepseek-chat': [
      `StratIQ, ClearEdge, BuildMate, AlphaPrime, SolidPro`
    ],
    'deepseek-coder': [
      `DevToolX, IntegrateX, OpenFrame, CodeCraft, ModularLogic`
    ]
  };

  const responses = demoResponses[modelKey] || demoResponses['gpt-4o'];
  return responses[Math.floor(Math.random() * responses.length)] + ' [DEMO MODE - Real API keys required for actual AI responses]';
}


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

  // Demo mode - return fake responses if no API keys are configured
  const hasApiKeys = (
    (config.provider === 'openai' && process.env.OPENAI_API_KEY) ||
    (config.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) ||
    (config.provider === 'deepseek' && process.env.DEEPSEEK_API_KEY)
  );

  if (!hasApiKeys) {
    // Return demo response
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000)); // Simulate API delay
    return generateDemoResponse(prompt, modelKey);
  }

  // Check if API keys are available for real calls
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

// Parse CSV from buffer
import { Readable } from 'stream';

function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];

    const stream = Readable.from(buffer.toString());
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Generate Excel buffer
function generateExcel(data) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Recommendations');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Test endpoint
app.get('/api/test', (_req, res) => {
  res.json({ message: 'API is working', timestamp: new Date().toISOString() });
});

// API Routes
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {
  console.log('Upload request received');
  console.log('File:', req.file ? 'Present' : 'Missing');
  console.log('Body:', req.body);

  try {
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { selectedModels, iterations } = req.body;

    if (!selectedModels) {
      console.log('No models selected');
      return res.status(400).json({ error: 'No models selected' });
    }

    let models;
    try {
      models = JSON.parse(selectedModels);
      console.log('Parsed models:', models);
    } catch (parseError) {
      console.log('JSON parse error:', parseError);
      return res.status(400).json({ error: 'Invalid models format' });
    }

    if (!Array.isArray(models) || models.length === 0) {
      return res.status(400).json({ error: 'At least one model must be selected' });
    }

    const iterationCount = parseInt(iterations) || 1;

    // Parse CSV from memory buffer
    const csvData = await parseCSV(req.file.buffer);
    
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
      const prompt = `You are a helpful assistant who provides concise, high-quality recommendations.\nWhat are the top 5 brands for ${productInfo}? Provide only the brand names separated by commas with no additional text.`;

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

    // Generate Excel buffer
    const excelBuffer = generateExcel(results);
    const outputFileName = `recommendations_${Date.now()}.xlsx`;

    // Return JSON response with base64 data
    res.json({
      success: true,
      downloadUrl: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${excelBuffer.toString('base64')}`,
      filename: outputFileName,
      totalRecommendations: results.length
    });

  } catch (error) {
    console.error('Processing error:', error);

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

  const hasAnyApiKey = status.openai || status.anthropic || status.deepseek;

  // In demo mode, all models are "available"
  const availableModels = hasAnyApiKey
    ? Object.entries(AI_MODELS).filter(([_key, config]) => {
        return status[config.provider];
      }).map(([modelKey]) => modelKey)
    : Object.keys(AI_MODELS); // All models available in demo mode

  res.json({
    apiKeys: status,
    availableModels,
    totalModels: Object.keys(AI_MODELS).length,
    demoMode: !hasAnyApiKey
  });
});

// Download endpoint removed - files are now returned directly in the upload response

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
