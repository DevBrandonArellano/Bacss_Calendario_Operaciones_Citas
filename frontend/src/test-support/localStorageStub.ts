/**
 * En Node 22+ el `localStorage` global choca con el de jsdom (ver nota en
 * AppLayout.test.tsx): queda expuesto un objeto sin sus métodos de Storage.
 * Código que solo necesita ocultar esto usa `vi.mock("@/lib/tokenStorage")`,
 * pero `useTheme` habla con `localStorage` directamente porque es estado de
 * UI liviano, no credenciales — así que sus tests necesitan un `localStorage`
 * que funcione de verdad. Esto instala un stub en memoria por test.
 */
export function installInMemoryLocalStorage(): void {
  const store = new Map<string, string>();

  const stub: Storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
}
