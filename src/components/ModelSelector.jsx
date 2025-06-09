const ModelSelector = ({ models, selectedModels, onModelSelect, availableModels = [] }) => {
  const handleModelToggle = (modelId) => {
    const updatedSelection = selectedModels.includes(modelId)
      ? selectedModels.filter(id => id !== modelId)
      : [...selectedModels, modelId];
    
    onModelSelect(updatedSelection);
  };

  const groupedModels = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {});

  const getProviderColor = (provider) => {
    const colors = {
      'OpenAI': 'bg-green-50 border-green-200',
      'Anthropic': 'bg-blue-50 border-blue-200',
      'DeepSeek': 'bg-purple-50 border-purple-200'
    };
    return colors[provider] || 'bg-gray-50 border-gray-200';
  };

  const getProviderIcon = (provider) => {
    const icons = {
      'OpenAI': '🤖',
      'Anthropic': '🧠',
      'DeepSeek': '🔍'
    };
    return icons[provider] || '🤖';
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-600 mb-4">
        Selected: {selectedModels.length} of {models.length} models
      </div>
      
      {Object.entries(groupedModels).map(([provider, providerModels]) => (
        <div key={provider} className={`rounded-lg border p-4 ${getProviderColor(provider)}`}>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
            <span className="mr-2 text-lg">{getProviderIcon(provider)}</span>
            {provider}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {providerModels.map((model) => {
              const isAvailable = availableModels.includes(model.id);
              return (
                <label
                  key={model.id}
                  className={`flex items-center space-x-3 p-3 rounded-md border transition-colors ${
                    isAvailable
                      ? 'bg-white hover:bg-gray-50 cursor-pointer'
                      : 'bg-gray-100 cursor-not-allowed opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(model.id)}
                    onChange={() => handleModelToggle(model.id)}
                    disabled={!isAvailable}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <div className={`font-medium ${isAvailable ? 'text-gray-900' : 'text-gray-500'}`}>
                      {model.name}
                      {!isAvailable && <span className="ml-2 text-xs">(API key required)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{model.provider}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      
      {selectedModels.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">Selected Models:</h4>
          <div className="flex flex-wrap gap-2">
            {selectedModels.map((modelId) => {
              const model = models.find(m => m.id === modelId);
              return (
                <span
                  key={modelId}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {model?.name}
                  <button
                    onClick={() => handleModelToggle(modelId)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
