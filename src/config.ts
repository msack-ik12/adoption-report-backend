import dotenv from 'dotenv';
dotenv.config();

export const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash';

export const config = {
  port: parseInt(process.env.PORT || '8787', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  internalApiToken: process.env.INTERNAL_API_TOKEN || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || GEMINI_FALLBACK_MODEL,
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '25', 10),
  get llmProvider(): 'gemini' | 'claude' | 'mock' {
    if (this.geminiApiKey && this.geminiApiKey !== 'your-key-here') return 'gemini';
    if (this.anthropicApiKey && this.anthropicApiKey !== 'sk-ant-...') return 'claude';
    return 'mock';
  },
  get isMockMode(): boolean {
    return this.llmProvider === 'mock';
  },
};
