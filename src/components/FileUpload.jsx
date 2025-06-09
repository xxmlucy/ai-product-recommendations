import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const FileUpload = ({ onFileSelect, selectedFile }) => {
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'text/csv') {
      onFileSelect(file);
    } else {
      alert('Please select a valid CSV file');
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-400 bg-blue-50'
            : selectedFile
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          <div className="text-4xl">
            {selectedFile ? '✅' : '📁'}
          </div>
          
          {selectedFile ? (
            <div>
              <p className="text-green-700 font-semibold">File selected:</p>
              <p className="text-gray-600">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                Size: {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          ) : isDragActive ? (
            <p className="text-blue-600">Drop the CSV file here...</p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">
                Drag and drop a CSV file here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                CSV files only. The file should contain product information in columns.
              </p>
            </div>
          )}
        </div>
      </div>
      
      {selectedFile && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">CSV Format Requirements:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Each row should represent a product</li>
            <li>• Minimum: One "Product" column with product names</li>
            <li>• Optional: Additional columns like Category, Description, Price, etc.</li>
            <li>• The AI will use all column data to generate recommendations</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
