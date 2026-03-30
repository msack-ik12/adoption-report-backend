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
  gongAccessKey: process.env.GONG_ACCESS_KEY || '',
  gongAccessKeySecret: process.env.GONG_ACCESS_KEY_SECRET || '',
  gongBaseUrl: process.env.GONG_BASE_URL || 'https://us-11211.api.gong.io/v2',
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '25', 10),
  sigmaClientId: process.env.SIGMA_CLIENT_ID || '',
  sigmaClientSecret: process.env.SIGMA_CLIENT_SECRET || '',
  sigmaBaseUrl: process.env.SIGMA_BASE_URL || 'https://aws-api.sigmacomputing.com',
  sigmaWorkbookId: process.env.SIGMA_WORKBOOK_ID || '',
  sigmaDistrictControlId: process.env.SIGMA_DISTRICT_CONTROL_ID || 'organization-name',
  get llmProvider(): 'gemini' | 'claude' | 'mock' {
    if (this.anthropicApiKey && this.anthropicApiKey !== 'sk-ant-...') return 'claude';
    if (this.geminiApiKey && this.geminiApiKey !== 'your-key-here') return 'gemini';
    return 'mock';
  },
  get isMockMode(): boolean {
    return this.llmProvider === 'mock';
  },
};
