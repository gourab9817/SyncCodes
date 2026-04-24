import api from "../services/api";

export const executeCode = async ({ language, sourceCode }) => {
  console.log(`Executing ${language} code...`);
  
  try {
    // Call our backend API which uses Judge0
    const response = await api.post('/api/execute/code', {
      language: language.toLowerCase(),
      sourceCode: sourceCode,
    });
    
    return response.data;
  } catch (error) {
    console.error('Execution error:', error);
    
    // Return formatted error response
    return {
      run: {
        output: '',
        stderr: error.response?.data?.run?.stderr || error.response?.data?.error || error.message || 'Execution failed',
        code: 1
      }
    };
  }
};
