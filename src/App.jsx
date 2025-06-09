import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import FileUpload from './components/FileUpload'
import ModelSelector from './components/ModelSelector'
import ProgressTracker from './components/ProgressTracker'
import './App.css'

const AI_MODELS = [
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-o3', name: 'GPT-o3', provider: 'OpenAI' },
  { id: 'claude-3.7', name: 'Claude 3.7', provider: 'Anthropic' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'Anthropic' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
  { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek' }
];

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedModels, setSelectedModels] = useState([]);
  const [iterations, setIterations] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [socket, setSocket] = useState(null);

  // Check API status and initialize socket on component mount
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch('/api/status');
        const status = await response.json();
        setApiStatus(status);
      } catch (err) {
        console.error('Failed to check API status:', err);
      }
    };

    // Initialize socket connection
    const socketConnection = io(process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3001');
    setSocket(socketConnection);

    checkApiStatus();

    return () => {
      if (socketConnection) {
        socketConnection.disconnect();
      }
    };
  }, []);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleModelSelect = (modelIds) => {
    setSelectedModels(modelIds);
  };

  const handleSelectAllModels = () => {
    if (selectedModels.length === AI_MODELS.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(AI_MODELS.map(model => model.id));
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file');
      return;
    }
    if (selectedModels.length === 0) {
      setError('Please select at least one AI model');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setDownloadUrl(null);

    const formData = new FormData();
    formData.append('csvFile', selectedFile);
    formData.append('selectedModels', JSON.stringify(selectedModels));
    formData.append('iterations', iterations.toString());
    if (socket) {
      formData.append('socketId', socket.id);
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const result = await response.json();

      if (result.success) {
        setDownloadUrl(result.downloadUrl);
      } else {
        setError(result.error || 'Processing failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      if (err.name === 'SyntaxError') {
        setError('Server returned invalid response. Please check server logs.');
      } else {
        setError('Network error: ' + err.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            AI Product Recommendation Generator
          </h1>

          <div className="space-y-8">
            {/* File Upload Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                1. Upload Product CSV File
              </h2>
              <FileUpload onFileSelect={handleFileSelect} selectedFile={selectedFile} />
            </div>

            {/* API Status Warning */}
            {apiStatus && apiStatus.availableModels.length === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h3 className="font-semibold text-red-800 mb-2">⚠️ No API Keys Configured</h3>
                <p className="text-red-700 mb-2">
                  No AI model API keys are configured. Please add your API keys to the .env file:
                </p>
                <ul className="text-sm text-red-600 space-y-1">
                  <li>• OPENAI_API_KEY (for GPT models)</li>
                  <li>• ANTHROPIC_API_KEY (for Claude models)</li>
                  <li>• DEEPSEEK_API_KEY (for DeepSeek models)</li>
                </ul>
              </div>
            )}

            {/* Model Selection Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                2. Select AI Models
                {apiStatus && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({apiStatus.availableModels.length} of {apiStatus.totalModels} available)
                  </span>
                )}
              </h2>
              <div className="mb-4">
                <button
                  onClick={handleSelectAllModels}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  disabled={apiStatus && apiStatus.availableModels.length === 0}
                >
                  {selectedModels.length === AI_MODELS.length ? 'Deselect All' : 'Select All Models'}
                </button>
              </div>
              <ModelSelector
                models={AI_MODELS}
                selectedModels={selectedModels}
                onModelSelect={handleModelSelect}
                availableModels={apiStatus?.availableModels || []}
              />
            </div>

            {/* Iterations Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                3. Number of Iterations
              </h2>
              <div className="flex items-center space-x-4">
                <label htmlFor="iterations" className="text-gray-700">
                  Iterations per model:
                </label>
                <input
                  id="iterations"
                  type="number"
                  min="1"
                  max="10"
                  value={iterations}
                  onChange={(e) => setIterations(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Processing/Results Section */}
            {isProcessing && (
              <ProgressTracker
                onComplete={() => {
                  // Progress tracker will handle the completion automatically
                  // The download URL will be set by the API response
                }}
              />
            )}

            {downloadUrl && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-green-800 mb-2">Processing completed successfully!</p>
                <a
                  href={downloadUrl}
                  download
                  className="inline-block px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Download Excel Results
                </a>
              </div>
            )}

            {/* Submit Button */}
            <div className="text-center">
              <button
                onClick={handleSubmit}
                disabled={isProcessing || !selectedFile || selectedModels.length === 0}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-semibold"
              >
                {isProcessing ? 'Processing...' : 'Generate Recommendations'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
