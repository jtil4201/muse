import {injectable} from 'inversify';
import {prisma} from '../utils/db.js';
import debug from '../utils/debug.js';

type Seconds = number;

type Options = {
  expiresIn: Seconds;
  key?: string;
  shouldCache?: (result: any) => boolean;
};

const futureTimeToDate = (time: Seconds) => new Date(new Date().getTime() + (time * 1000));

@injectable()
export default class KeyValueCacheProvider {
  async wrap<T extends [...any[], Options], F>(func: (...options: any) => Promise<F>, ...options: T): Promise<F> {
    if (options.length === 0) {
      throw new Error('Missing cache options');
    }

    const functionArgs = options.slice(0, options.length - 1);

    const {
      key = JSON.stringify(functionArgs),
      expiresIn,
      shouldCache,
    } = options[options.length - 1] as Options;

    if (key.length < 4) {
      throw new Error(`Cache key ${key} is too short.`);
    }

    const cachedResult = await prisma.keyValueCache.findUnique({
      where: {
        key,
      },
    });

    if (cachedResult) {
      if (new Date() < cachedResult.expiresAt) {
        debug(`Cache hit: ${key}`);
        return JSON.parse(cachedResult.value) as F;
      }

      // Keep the expired row until upsert replaces it. Concurrent readers may
      // have observed the same row, so deleting it here races their refreshes.
    }

    debug(`Cache miss: ${key}`);

    const result = await func(...options as any[]);

    // Don't persist empty/failed lookups (e.g. a transient YouTube blip),
    // so one bad response can't linger for the whole TTL.
    if (shouldCache && !shouldCache(result)) {
      return result;
    }

    // Save result
    const value = JSON.stringify(result);
    const expiresAt = futureTimeToDate(expiresIn);
    await prisma.keyValueCache.upsert({
      where: {
        key,
      },
      update: {
        value,
        expiresAt,
      },
      create: {
        key,
        value,
        expiresAt,
      },
    });

    return result;
  }
}
