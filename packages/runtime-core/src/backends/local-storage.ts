import type { ConfigBackend } from '@proj-airi/core'

export class LocalStorageBackend implements ConfigBackend {
  constructor(private key = 'airi.config') {}

  async get() {
    const r = localStorage.getItem(this.key)
    return r ? JSON.parse(r) : {}
  }

  async set(v: unknown) {
    localStorage.setItem(this.key, JSON.stringify(v))
  }

  subscribe(cb: () => void) {
    const h = (e: StorageEvent) => {
      if (e.key === this.key)
        cb()
    }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }
}
