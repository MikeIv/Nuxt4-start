export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    console.log("🔧 Payload disabler plugin loaded");

    if (window.__NUXT__) {
      window.__NUXT__.loadPayload = () => {
        console.log("📦 Payload loading disabled");
        return Promise.resolve(null);
      };
    }

    const originalError = console.error;
    console.error = function (...args) {
      if (
        args[0] &&
        typeof args[0] === "string" &&
        args[0].includes("_payload.json")
      ) {
        console.warn("⚠️ Payload error suppressed");
        return;
      }
      originalError.apply(console, args);
    };
  }
});
