const { parseResume, generateQuestions } = require('../services/geminiService');
const { z } = require('zod');

const generate = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { difficultyLevel, numberOfQuestions, topics } = z
      .object({
        difficultyLevel: z.coerce.number().int().min(1).max(5).default(3),
        numberOfQuestions: z.coerce.number().int().min(1).max(30).default(10),
        topics: z
          .preprocess(
            (v) => (typeof v === 'string' ? JSON.parse(v) : v),
            z.array(z.string())
          )
          .default(['Skills', 'Projects', 'Experience']),
      })
      .parse(req.body);

    const resumeText = await parseResume(req.file);

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Resume content is too short or empty' });
    }

    const questions = await generateQuestions({
      resumeText,
      difficultyLevel,
      numberOfQuestions,
      topics,
    });

    if (questions.length < Math.ceil(numberOfQuestions / 2)) {
      return res.status(500).json({ error: 'Failed to generate sufficient questions' });
    }

    res.json({ success: true, questions });
  } catch (err) {
    next(err);
  }
};

module.exports = { generate };
