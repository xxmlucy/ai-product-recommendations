# AI Product Recommendation Generator

A web application that generates product recommendations using multiple AI models including GPT-4, Claude, and DeepSeek.

## Features

- **CSV Upload**: Upload product data in CSV format
- **Multiple AI Models**: Choose from 8 different AI models:
  - GPT-4.1, GPT-4o, GPT-o3 (OpenAI)
  - Claude 3.7, Claude Sonnet 4, Claude Opus 4 (Anthropic)
  - DeepSeek Chat, DeepSeek Coder (DeepSeek)
- **Batch Processing**: Select all models or specific ones
- **Multiple Iterations**: Run multiple iterations per model
- **Excel Export**: Download results in Excel format with raw AI outputs

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure API Keys**

   Copy `.env.example` to `.env` and add your API keys:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   ```

3. **Run the Application**
   ```bash
   npm run dev
   ```

   This will start both the backend server (port 3001) and frontend development server.

## Usage

1. **Upload CSV**: Upload a CSV file containing your product data
2. **Select Models**: Choose which AI models to use for recommendations
3. **Set Iterations**: Choose how many times to run each model
4. **Generate**: Click "Generate Recommendations" to start processing
5. **Download**: Download the Excel file with all recommendations

## CSV Format

Your CSV file should contain product information. The simplest format is:
- **Single Column**: Just a "Product" column with product names
- **Multiple Columns**: You can include additional columns like Description, Category, Price, Features, etc.

Examples:
```csv
Product
Sofa
Table
Chair
Lamp
```

Or with more details:
```csv
Product,Category,Description
Sofa,Furniture,Comfortable living room sofa
Table,Furniture,Dining room table for 6 people
```

The AI models will use all available column data to generate relevant recommendations.

## API Keys Required

To use all features, you'll need API keys from:

- **OpenAI**: For GPT models - Get from [OpenAI Platform](https://platform.openai.com/)
- **Anthropic**: For Claude models - Get from [Anthropic Console](https://console.anthropic.com/)
- **DeepSeek**: For DeepSeek models - Get from [DeepSeek Platform](https://platform.deepseek.com/)

You can use the application with just some of these keys - simply select only the models for which you have API keys.

## Output Format

The generated Excel file contains:
- Original Product: The input product information
- Model: Which AI model generated the recommendation
- Iteration: Which iteration number (if multiple iterations selected)
- Recommendation: The raw AI-generated recommendation
- Timestamp: When the recommendation was generated

## Troubleshooting

- **API Errors**: Check that your API keys are correctly set in the `.env` file
- **File Upload Issues**: Ensure your file is in CSV format
- **Processing Timeout**: Large files or many iterations may take several minutes

## Development

- Frontend: React with Vite and Tailwind CSS
- Backend: Node.js with Express
- File Processing: CSV parsing and Excel generation
- AI Integration: OpenAI, Anthropic, and DeepSeek APIs
