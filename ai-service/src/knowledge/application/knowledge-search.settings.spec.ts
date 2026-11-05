import { ConfigService } from '@nestjs/config';
import { createKnowledgeSearchSettings } from './knowledge-search.settings';

describe('createKnowledgeSearchSettings', () => {
  it('uses the calibrated defaults', () => {
    expect(createKnowledgeSearchSettings(new ConfigService({}))).toEqual({
      limit: 4,
      maxDistance: 0.35,
    });
  });

  it('reads KNOWLEDGE_MAX_DISTANCE from the configuration', () => {
    expect(
      createKnowledgeSearchSettings(
        new ConfigService({ KNOWLEDGE_MAX_DISTANCE: '0.4' }),
      ).maxDistance,
    ).toBe(0.4);
  });

  it.each(['abc', '0', '3'])(
    'fails fast at startup when KNOWLEDGE_MAX_DISTANCE is %s',
    (value) => {
      expect(() =>
        createKnowledgeSearchSettings(
          new ConfigService({ KNOWLEDGE_MAX_DISTANCE: value }),
        ),
      ).toThrow('KNOWLEDGE_MAX_DISTANCE');
    },
  );
});
