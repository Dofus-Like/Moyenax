export type RedisMock = {
  getJson: jest.Mock;
  setJson: jest.Mock;
  set: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
  expire: jest.Mock;
  setIfNotExists: jest.Mock;
  keys: jest.Mock;
  _store: Map<string, unknown>;
};

export function makeRedisMock(): RedisMock {
  const store = new Map<string, unknown>();

  const getJson = jest.fn(async (key: string) => {
    return store.has(key) ? JSON.parse(store.get(key) as string) : null;
  });

  const setJson = jest.fn(async (key: string, value: unknown, _ttl?: number) => {
    store.set(key, JSON.stringify(value));
    return 'OK';
  });

  const set = jest.fn(async (key: string, value: string) => {
    store.set(key, value);
    return 'OK';
  });

  const get = jest.fn(async (key: string) => {
    return store.has(key) ? (store.get(key) as string) : null;
  });

  const del = jest.fn(async (key: string) => {
    const had = store.has(key);
    store.delete(key);
    return had ? 1 : 0;
  });

  const expire = jest.fn(async () => 1);

  const setIfNotExists = jest.fn(async (key: string, value: string, _ttl?: number) => {
    if (store.has(key)) return false;
    store.set(key, value);
    return true;
  });

  const keys = jest.fn(async (pattern: string) => {
    const prefix = pattern.replace('*', '');
    return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
  });

  return { getJson, setJson, set, get, del, expire, setIfNotExists, keys, _store: store };
}
