import React, { useState } from 'react';
import { X, Upload, FileText, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const ResumeInterviewModal = ({ isOpen, onClose, darkMode, roomId }) => {
  const [file, setFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [showOptionsForm, setShowOptionsForm] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [jdDragActive, setJdDragActive] = useState(false);
  
  // Options state
  const [difficultyLevel, setDifficultyLevel] = useState(3);
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);
  const [selectedTopics, setSelectedTopics] = useState(['Skills', 'Projects', 'Experience']);
  
  const topicOptions = [
    { value: 'Skills', label: 'Skills & Technologies' },
    { value: 'Projects', label: 'Projects & Work' },
    { value: 'Experience', label: 'Professional Experience' },
    { value: 'Education', label: 'Education & Background' },
    { value: 'Certifications', label: 'Certifications & Licenses' },
    { value: 'Achievements', label: 'Achievements & Awards' },
    { value: 'Activities', label: 'Extra Activities & Interests' }
  ];
  
  const difficultyLabels = ['Easy', 'Moderate', 'Intermediate', 'Advanced', 'Expert'];;

  // Get backend URL from environment or default
  const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile) => {
    if (selectedFile) {
      const fileType = selectedFile.type;
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];
      
      if (validTypes.includes(fileType)) {
        setFile(selectedFile);
        setError(null);
        setUploadComplete(false);
        setQuestions([]);
        setShowOptionsForm(false);
      } else {
        setError('Please upload a PDF or DOCX file only.');
        toast.error('Invalid file format. Please upload PDF or DOCX.');
      }
    }
  };
  
  const handleTopicToggle = (topic) => {
    setSelectedTopics(prev => {
      if (prev.includes(topic)) {
        // Don't allow deselecting if it's the only one selected
        if (prev.length === 1) {
          toast.error('Please select at least one topic');
          return prev;
        }
        return prev.filter(t => t !== topic);
      } else {
        return [...prev, topic];
      }
    });
  };
  
  const handleProceedToOptions = () => {
    if (!file) {
      toast.error('Please select a file first.');
      return;
    }
    setShowOptionsForm(true);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // JD File handlers (UI only - no processing)
  const handleJDFileChange = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSetJDFile(selectedFile);
  };

  const validateAndSetJDFile = (selectedFile) => {
    if (selectedFile) {
      const fileType = selectedFile.type;
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain'
      ];
      
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (validTypes.includes(fileType) || selectedFile.name.endsWith('.pdf') || selectedFile.name.endsWith('.doc') || selectedFile.name.endsWith('.docx') || selectedFile.name.endsWith('.txt')) {
        if (selectedFile.size <= maxSize) {
          setJdFile(selectedFile);
          toast.success('JD file uploaded successfully!');
        } else {
          toast.error('JD file size must be less than 10MB.');
        }
      } else {
        toast.error('Please upload a PDF, DOCX, or TXT file for JD.');
      }
    }
  };

  const handleJDDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setJdDragActive(true);
    } else if (e.type === "dragleave") {
      setJdDragActive(false);
    }
  };

  const handleJDDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setJdDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetJDFile(e.dataTransfer.files[0]);
    }
  };

  const handleClearJD = () => {
    setJdFile(null);
    toast.success('JD file removed');
  };

  const handleUploadAndGenerate = async () => {
    if (!file) {
      toast.error('Please select a file first.');
      return;
    }
    
    if (selectedTopics.length === 0) {
      toast.error('Please select at least one topic.');
      return;
    }

    setIsUploading(true);
    setIsGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('difficultyLevel', difficultyLevel);
    formData.append('numberOfQuestions', numberOfQuestions);
    formData.append('topics', JSON.stringify(selectedTopics));

    try {
      // Upload and generate questions
      const response = await axios.post(`${BACKEND_URL}/api/generate-questions`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setQuestions(response.data.questions);
      setUploadComplete(true);
      setShowOptionsForm(false);
      toast.success('Interview questions generated successfully!');
    } catch (err) {
      console.error('Error generating questions:', err);
      setError(err.response?.data?.error || 'Failed to generate questions. Please try again.');
      toast.error('Failed to generate questions.');
    } finally {
      setIsUploading(false);
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    // Don't clear questions - keep them for next time modal opens
    setShowOptionsForm(false);
    setError(null);
    setIsUploading(false);
    setIsGenerating(false);
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setJdFile(null);
    setQuestions([]);
    setUploadComplete(false);
    setShowOptionsForm(false);
    setError(null);
    setDifficultyLevel(3);
    setNumberOfQuestions(10);
    setSelectedTopics(['Skills', 'Projects', 'Experience']);
    toast.success('Question bank cleared!');
  };
  
  const handleResetUpload = () => {
    // Reset only resume file and form, keep JD file and questions if they exist
    setFile(null);
    setUploadComplete(false);
    setShowOptionsForm(false);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${
        darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
      } rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-colors duration-300`}>
        
        {/* Header */}
        <div className={`px-6 py-4 border-b ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        } flex items-center justify-between`}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
              <FileText className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Resume Interview Questions</h2>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Upload resume and JD to generate AI-powered interview questions
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {questions.length > 0 && !showOptionsForm && !file ? (
            // Show existing questions if available
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <FileText size={24} />
                  <span className="font-semibold text-lg">Your Saved Questions</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleResetUpload}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    }`}
                  >
                    Generate New Questions
                  </button>
                  <button
                    onClick={handleReset}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border-2 border-red-300 dark:border-red-700`}
                  >
                    🗑️ Clear Question Bank
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-750 border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                    } hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        darkMode
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-purple-100 text-purple-600'
                      }`}>
                        {index + 1}
                      </div>
                      <p className="flex-1 text-base leading-relaxed pt-1">
                        {question}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !uploadComplete ? (
            !showOptionsForm ? (
              // Upload Section
              <div className="space-y-6">
              {/* Upload Areas Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Resume Upload Area */}
                <div className="flex flex-col">
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Resume Upload <span className="text-red-500">*</span>
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all flex-1 min-h-[200px] flex items-center justify-center ${
                      dragActive
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : darkMode
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      id="resume-upload"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                    
                    <label htmlFor="resume-upload" className="cursor-pointer w-full">
                      <div className="flex flex-col items-center space-y-3">
                        <div className={`p-3 rounded-full ${
                          darkMode ? 'bg-gray-700' : 'bg-gray-100'
                        }`}>
                          <FileText size={32} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
                        </div>
                        
                        {file ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                              <CheckCircle size={18} />
                              <span className="font-medium text-sm break-all">{file.name}</span>
                            </div>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Drop resume here or click to browse
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              PDF, DOC, DOCX (Max 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  {file && (
                    <button
                      onClick={handleResetUpload}
                      className="w-full text-xs text-red-600 dark:text-red-400 hover:underline mt-2 pt-1"
                    >
                      Remove Resume
                    </button>
                  )}
                </div>

                {/* JD Upload Area */}
                <div className="flex flex-col">
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Job Description (JD) Upload <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(Optional)</span>
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all flex-1 min-h-[200px] flex items-center justify-center ${
                      jdDragActive
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : darkMode
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleJDDrag}
                    onDragLeave={handleJDDrag}
                    onDragOver={handleJDDrag}
                    onDrop={handleJDDrop}
                  >
                    <input
                      type="file"
                      id="jd-upload"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleJDFileChange}
                      disabled={isUploading}
                    />
                    
                    <label htmlFor="jd-upload" className="cursor-pointer w-full">
                      <div className="flex flex-col items-center space-y-3">
                        <div className={`p-3 rounded-full ${
                          darkMode ? 'bg-gray-700' : 'bg-gray-100'
                        }`}>
                          <FileText size={32} className={darkMode ? 'text-purple-400' : 'text-purple-600'} />
                        </div>
                        
                        {jdFile ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                              <CheckCircle size={18} />
                              <span className="font-medium text-sm break-all">{jdFile.name}</span>
                            </div>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {(jdFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Drop JD here or click to browse
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              PDF, DOC, DOCX, TXT (Max 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  {jdFile && (
                    <button
                      onClick={handleClearJD}
                      className="w-full text-xs text-red-600 dark:text-red-400 hover:underline mt-2 pt-1"
                    >
                      Remove JD
                    </button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
                  <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* Info Message */}
              {jdFile && (
                <div className={`p-4 rounded-lg mt-2 mb-4 ${
                  darkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                }`}>
                  <p className={`text-sm leading-relaxed ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                    <strong>Note:</strong> JD file uploaded successfully. The JD feature is currently for display purposes only and will be integrated with question generation in future updates.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={handleProceedToOptions}
                  disabled={!file || isUploading}
                  className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                    !file || isUploading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  <span>Next: Customize Options →</span>
                </button>
              </div>
            </div>
            ) : (
              // Options Form Section
              <div className="space-y-6">
                <div className="mb-4 space-y-2">
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Resume: <span className="font-medium text-green-600 dark:text-green-400">{file.name}</span>
                  </p>
                  {jdFile && (
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      JD: <span className="font-medium text-purple-600 dark:text-purple-400">{jdFile.name}</span>
                    </p>
                  )}
                </div>

                {/* Number of Questions */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Number of Questions
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={numberOfQuestions}
                    onChange={(e) => setNumberOfQuestions(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  />
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Choose between 1 and 50 questions
                  </p>
                </div>

                {/* Difficulty Level */}
                <div>
                  <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Difficulty Level: <span className="text-purple-500 font-bold">{difficultyLabels[difficultyLevel - 1]}</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={difficultyLevel}
                      onChange={(e) => setDifficultyLevel(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between text-xs">
                      {difficultyLabels.map((label, index) => (
                        <span 
                          key={label}
                          className={`${
                            difficultyLevel === index + 1 
                              ? 'text-purple-600 dark:text-purple-400 font-bold' 
                              : darkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Question Topics */}
                <div>
                  <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Question Topics ({selectedTopics.length} selected)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {topicOptions.map((topic) => (
                      <button
                        key={topic.value}
                        onClick={() => handleTopicToggle(topic.value)}
                        className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                          selectedTopics.includes(topic.value)
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : darkMode
                            ? 'border-gray-600 hover:border-gray-500 bg-gray-700'
                            : 'border-gray-300 hover:border-gray-400 bg-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${
                            selectedTopics.includes(topic.value)
                              ? 'border-purple-500 bg-purple-500'
                              : darkMode ? 'border-gray-500' : 'border-gray-400'
                          }`}>
                            {selectedTopics.includes(topic.value) && (
                              <CheckCircle size={16} className="text-white" />
                            )}
                          </div>
                          <span className={`text-sm font-medium ${
                            selectedTopics.includes(topic.value)
                              ? 'text-purple-700 dark:text-purple-300'
                              : darkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {topic.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Select one or more topics to focus on
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={() => setShowOptionsForm(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    }`}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleUploadAndGenerate}
                    disabled={isGenerating || selectedTopics.length === 0}
                    className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                      isGenerating || selectedTopics.length === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <Loader className="animate-spin" size={18} />
                        <span>Generating Questions...</span>
                      </>
                    ) : (
                      <span>Generate {numberOfQuestions} Questions</span>
                    )}
                  </button>
                </div>
              </div>
            )
          ) : (
            // Questions Display Section
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                  <CheckCircle size={24} />
                  <span className="font-semibold text-lg">Questions Generated Successfully!</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleResetUpload}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    }`}
                  >
                    Upload New Resume
                  </button>
                  <button
                    onClick={handleReset}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border-2 border-red-300 dark:border-red-700`}
                  >
                    🗑️ Clear Question Bank
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      darkMode
                        ? 'bg-gray-750 border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                    } hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        darkMode
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-purple-100 text-purple-600'
                      }`}>
                        {index + 1}
                      </div>
                      <p className="flex-1 text-base leading-relaxed pt-1">
                        {question}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        } flex items-center justify-between`}>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {uploadComplete 
              ? `${questions.length} questions saved • Click "Clear Question Bank" to remove`
              : questions.length > 0
              ? `${questions.length} questions available • Click "Clear Question Bank" to remove`
              : jdFile
              ? 'Resume and JD upload ready • JD feature coming soon'
              : 'Upload resume and JD to generate AI-powered interview questions'}
          </p>
          <button
            onClick={handleClose}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeInterviewModal;

