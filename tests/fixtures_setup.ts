import { beforeAll } from 'vitest';
import { buildFixtures } from '../fixtures/buildBinaryFixtures';

beforeAll(async () => {
  await buildFixtures();
});

