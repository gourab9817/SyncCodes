const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const env = require('../config/env');

const genAI = new GoogleGenerativeAI(env.gemini.apiKey);

const parsePDF = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text;
};

const parseDOCX = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
};

const parseResume = async (file) => {
  const { mimetype, buffer } = file;
  if (mimetype === 'application/pdf') return parsePDF(buffer);
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  )
    return parseDOCX(buffer);
  throw new Error('Unsupported file format');
};

const DIFFICULTY_LABELS = {
  1: 'Easy - Basic understanding and fundamental concepts',
  2: 'Moderate - Practical application and common scenarios',
  3: 'Intermediate - In-depth knowledge and problem-solving',
  4: 'Advanced - Complex scenarios and architectural decisions',
  5: 'Expert - System design, optimization, and leadership',
};

const TOPIC_MAP = {
  Skills: 'technical skills, programming languages, tools, and technologies',
  Projects: 'project work, implementations, and deliverables',
  Experience: 'professional experience, roles, and responsibilities',
  Education: 'educational background, degrees, and academic achievements',
  Certifications: 'certifications, licenses, and professional credentials',
  Achievements: 'accomplishments, awards, and notable achievements',
  Activities: 'extracurricular activities, volunteer work, and personal interests',
};

const generateQuestions = async ({ resumeText, difficultyLevel, numberOfQuestions, topics }) => {
  const difficulty = DIFFICULTY_LABELS[difficultyLevel] || DIFFICULTY_LABELS[3];
  const topicFocus = topics.map((t) => TOPIC_MAP[t] || t).join(', ');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are an expert technical interviewer. Based on the following resume/CV, generate exactly ${numberOfQuestions} interview questions.

IMPORTANT REQUIREMENTS:
1. Difficulty Level: ${difficulty}
2. Focus Areas: ${topicFocus}
3. Questions must be specifically tailored to what is in the resume
4. Each question should directly reference or relate to resume content

Resume Content:
${resumeText}

Provide exactly ${numberOfQuestions} questions, numbered 1-${numberOfQuestions}. Only provide questions, no commentary.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const questions = text
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => l.replace(/^[\d]+[\.\)\:]?\s*/, '').trim())
    .filter((l) => l.length > 10)
    .slice(0, numberOfQuestions);

  return questions;
};

module.exports = { parseResume, generateQuestions };
