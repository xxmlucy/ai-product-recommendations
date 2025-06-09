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

// Demo response generator for public deployment
function generateDemoResponse(prompt, modelKey) {
  const productMatch = prompt.match(/Based on this product: "([^"]+)"/);
  const product = productMatch ? productMatch[1] : 'Unknown Product';

  const demoResponses = {
    'gpt-4.1': [
      `For ${product}, I recommend: 1) Complementary accessories that enhance functionality, 2) Similar products from trusted brands, 3) Maintenance or care items, 4) Upgraded versions with additional features, 5) Bundle deals that offer better value.`,
      `Based on ${product}, consider: 1) Related items that customers frequently buy together, 2) Seasonal alternatives, 3) Premium versions with enhanced quality, 4) Eco-friendly alternatives, 5) Smart/connected versions if available.`
    ],
    'gpt-4o': [
      `Recommendations for ${product}: 1) Essential accessories for optimal use, 2) Comparable products with different features, 3) Professional-grade alternatives, 4) Budget-friendly options, 5) Limited edition or designer versions.`,
      `For ${product} users, I suggest: 1) Protective cases or covers, 2) Cleaning and maintenance supplies, 3) Upgrade components, 4) Compatible accessories, 5) Extended warranty options.`
    ],
    'gpt-o3': [
      `${product} recommendations: 1) Multi-functional alternatives, 2) Space-saving versions, 3) Energy-efficient models, 4) Customizable options, 5) Professional installation services.`,
      `Considering ${product}, explore: 1) Next-generation models, 2) Refurbished options for savings, 3) Rental alternatives, 4) DIY kits, 5) Educational resources and tutorials.`
    ],
    'claude-3.7': [
      `For ${product}, thoughtful recommendations include: 1) Ergonomic improvements, 2) Sustainable alternatives, 3) Multi-purpose solutions, 4) Travel-friendly versions, 5) Community-recommended brands.`,
      `${product} suggestions: 1) User-reviewed top picks, 2) Innovation-focused alternatives, 3) Value-engineered options, 4) Artisan or handcrafted versions, 5) Local marketplace finds.`
    ],
    'claude-sonnet-4': [
      `Curated ${product} recommendations: 1) Award-winning designs, 2) Customer satisfaction leaders, 3) Emerging brand innovations, 4) Vintage or retro alternatives, 5) Subscription-based services.`,
      `For ${product} enthusiasts: 1) Expert-recommended upgrades, 2) Collaborative or sharing options, 3) Modular systems, 4) Smart home integration, 5) Health and wellness focused alternatives.`
    ],
    'claude-opus-4': [
      `Premium ${product} selections: 1) Luxury market leaders, 2) Innovative startups, 3) Sustainable manufacturing, 4) Personalization options, 5) Exclusive member benefits.`,
      `${product} ecosystem: 1) Complementary technology, 2) Service partnerships, 3) Educational workshops, 4) Community forums, 5) Expert consultation services.`
    ],
    'deepseek-chat': [
      `${product} analysis suggests: 1) Data-driven top performers, 2) Trend-based predictions, 3) Algorithm-optimized choices, 4) User behavior insights, 5) Market efficiency leaders.`,
      `Deep insights for ${product}: 1) Performance metrics leaders, 2) Cost-benefit optimized, 3) Future-proof investments, 4) Integration capabilities, 5) Scalability considerations.`
    ],
    'deepseek-coder': [
      `Technical ${product} recommendations: 1) API-compatible solutions, 2) Open-source alternatives, 3) Developer-friendly tools, 4) Automation possibilities, 5) Integration frameworks.`,
      `${product} tech stack: 1) Programmable interfaces, 2) Cloud-native options, 3) Microservice architecture, 4) DevOps integration, 5) Monitoring and analytics tools.`
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

    // Generate Excel buffer
    const excelBuffer = generateExcel(results);
    const outputFileName = `recommendations_${Date.now()}.xlsx`;

    // Return Excel file directly
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
    res.setHeader('Content-Length', excelBuffer.length);

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
