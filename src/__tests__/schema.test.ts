import { describe, it, expect } from 'vitest';
import { GeneratedReportSchema } from '../services/schema';

describe('GeneratedReportSchema', () => {
  it('validates a complete sample report', () => {
    const sample = {
      internal: {
        reportType: 'internal',
        title: 'Test District Adoption Report',
        districtName: 'Test District',
        generatedAt: '2024-01-15T00:00:00.000Z',
        slides: [
          {
            slideNumber: 1,
            title: 'Executive Summary',
            sections: [
              {
                heading: 'Overview',
                bullets: ['Bullet 1', 'Bullet 2'],
                chartSpecs: [
                  { chartType: 'bar', title: 'Users', data: { labels: ['A'], values: [10] } },
                ],
                quotes: ['Great product!'],
                trackedClaims: [
                  {
                    claim: '70% adoption rate',
                    confidence: 'High',
                    sources: [{ tableId: 'sigma_abc', columns: ['weekly_active'] }],
                  },
                ],
              },
            ],
          },
        ],
      },
      spotlight: {
        reportType: 'spotlight',
        title: 'Test Spotlight',
        districtName: 'Test District',
        generatedAt: '2024-01-15T00:00:00.000Z',
        onePage: {
          header: 'Test District Spotlight',
          subheader: 'A success story',
          kpis: [
            { label: 'Active Users', value: '85%', delta: '+15%' },
          ],
          charts: [],
          quotes: [{ text: 'This changed everything', attribution: 'Superintendent' }],
          closingCta: 'Contact us to learn more',
          trackedClaims: [],
        },
      },
      story: {
        reportType: 'story',
        title: 'Test Story',
        districtName: 'Test District',
        generatedAt: '2024-01-15T00:00:00.000Z',
        frames: [
          { frameNumber: 1, templateType: 'intro', headline: 'Welcome', narrative: 'Intro text' },
          { frameNumber: 2, templateType: 'stat', headline: '85% Active', chartSpec: { chartType: 'number', title: 'Active', data: 85 } },
          { frameNumber: 3, templateType: 'cta', headline: 'Next Steps', nextActionCta: 'Book a call' },
        ],
      },
      diagnostics: {
        confidenceByClaim: [
          { claim: 'Test claim', confidence: 'High', sources: [{ tableId: 'sigma_abc' }] },
        ],
        dataGaps: ['No sendback data'],
        sourceMap: [
          { tableId: 'sigma_abc', filename: 'users.csv', tableType: 'user_activity', rowCount: 100 },
        ],
      },
    };

    const result = GeneratedReportSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it('validates minimal report with only diagnostics', () => {
    const minimal = {
      diagnostics: {
        confidenceByClaim: [],
        dataGaps: [],
        sourceMap: [],
      },
    };

    const result = GeneratedReportSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('rejects report missing diagnostics', () => {
    const bad = {
      internal: {
        reportType: 'internal',
        title: 'Test',
        districtName: 'Test',
        generatedAt: '2024-01-15T00:00:00.000Z',
        slides: [],
      },
    };

    const result = GeneratedReportSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects invalid confidence level', () => {
    const bad = {
      diagnostics: {
        confidenceByClaim: [
          { claim: 'Test', confidence: 'VeryHigh', sources: [] },
        ],
        dataGaps: [],
        sourceMap: [],
      },
    };

    const result = GeneratedReportSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
