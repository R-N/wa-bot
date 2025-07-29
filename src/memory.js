export class InMemoryRedis {
  constructor() {
    this.store = new Map();
    this.expiry = new Map();
  }

  async connect() {}
  async quit() {}

  _checkExpiry(key) {
    const expiresAt = this.expiry.get(key);
    if (expiresAt && Date.now() > expiresAt) {
      this.store.delete(key);
      this.expiry.delete(key);
    }
  }

  async exists(key) {
    this._checkExpiry(key);
    return this.store.has(key) ? 1 : 0;
  }

  async setEx(key, ttlSeconds, value) {
    this.store.set(key, value);
    this.expiry.set(key, Date.now() + ttlSeconds * 1000);
  }

  async lRange(key, start, stop) {
    this._checkExpiry(key);
    const list = this.store.get(key) || [];
    return list.slice(start, stop + 1);
  }

  async rPush(key, value) {
    this._checkExpiry(key);
    const list = this.store.get(key) || [];
    list.push(value);
    this.store.set(key, list);
  }

  async expire(key, ttlSeconds) {
    if (this.store.has(key)) {
      this.expiry.set(key, Date.now() + ttlSeconds * 1000);
    }
  }
}

export default InMemoryRedis;
