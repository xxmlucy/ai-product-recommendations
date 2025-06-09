import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const ProgressTracker = ({ onComplete }) => {
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    percentage: 0,
    currentProduct: '',
    currentModel: '',
    iteration: 1,
    status: 'Initializing...'
  });

  useEffect(() => {
    const socket = io(process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3001');

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('progress', (progressData) => {
      setProgress(progressData);

      // Call onComplete when processing is finished
      if (progressData.percentage === 100 && onComplete) {
        setTimeout(() => {
          onComplete();
        }, 2000); // Wait 2 seconds to show completion
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          Processing Recommendations
        </h3>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{progress.completed} of {progress.total} completed</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>

        {/* Current Status */}
        <div className="mb-4">
          <p className="text-blue-700 font-medium mb-1">{progress.status}</p>
          {progress.currentProduct && (
            <div className="text-sm text-gray-600">
              <p><strong>Product:</strong> {progress.currentProduct}</p>
              <p><strong>Model:</strong> {progress.currentModel}</p>
              {progress.iteration && <p><strong>Iteration:</strong> {progress.iteration}</p>}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 text-left">
          <h4 className="font-semibold text-gray-800 mb-2">Processing Steps:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Parsing your CSV file ✓</li>
            <li>• Generating prompts for each product ✓</li>
            <li>• Calling selected AI models {progress.percentage > 0 ? '🔄' : '⏳'}</li>
            <li>• Running multiple iterations as requested {progress.percentage > 50 ? '🔄' : '⏳'}</li>
            <li>• Compiling results into Excel format {progress.percentage === 100 ? '🔄' : '⏳'}</li>
          </ul>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          <p>Please keep this tab open while processing...</p>
          {progress.total > 0 && (
            <p>Estimated time remaining: {Math.ceil((progress.total - progress.completed) * 3)} seconds</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;
