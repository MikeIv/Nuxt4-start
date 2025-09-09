import svgLoader from "vite-svg-loader";

const API_BASE_URL =
  process.env.NUXT_PUBLIC_API_BASE ||
  "https://lk-schelkovsky-api.grandfs-develop.ru/api/v1";
const IS_DEV = process.env.NODE_ENV === "development";
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  runtimeConfig: {
    public: {
      apiBase: API_BASE_URL,
      isDev: IS_DEV,
    },
  },
  nitro: {
    devProxy: {
      "/api": {
        target: API_BASE_URL,
        changeOrigin: true,
        cors: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },

        cookies: {
          parse: true,
          overwrite: true,
        },
      },
    },
    ...(!IS_DEV && {
      minify: true,
      prerender: {
        crawlLinks: true,
        failOnError: false,
      },
    }),
  },

  devtools: {
    enabled: IS_DEV,
    timeline: {
      enabled: IS_DEV,
    },
  },

  build: {
    transpile: [
      "@nuxt/ui",
      "@nuxt/icon",
      "@nuxt/image",
      "@nuxt/eslint",
      "@vueuse/nuxt",
      "@pinia/nuxt",
      "truncate-html",
    ],
    ...(!IS_DEV && {
      analyze: {
        analyzerMode: "static",
        openAnalyzer: false,
      },
    }),
  },

  ssr: false,

  devServer: {
    https: false,
    watchOptions: {
      usePolling: true,
      interval: 1000,
    },
  },

  features: {
    devLogs: false,
  },
  experimental: {
    payloadExtraction: true,
    componentIslands: true,
    viewTransition: true,
  },

  modules: [
    "@nuxt/ui",
    "@nuxt/eslint",
    "@vueuse/nuxt",
    "@nuxt/icon",
    "@pinia/nuxt",
  ],

  components: [
    { path: "~/components/core", prefix: "Core" },
    { path: "~/components/modules", prefix: "Module" },
    "~/components",
  ],

  imports: {
    dirs: [
      "composables",
      "composables/*/index.{ts,js,mjs,mts}",
      "composables/**",
    ],
  },

  eslint: {
    config: {
      plugins: ["vue"],
      extends: [
        "plugin:vue/vue3-essential",
        "@nuxt/eslint-config",
        "plugin:prettier/recommended",
      ],
      rules: {
        "vue/no-multiple-template-root": "off",
        "vue/require-default-prop": "off",
        "vue/multi-word-component-names": "warn",
        "vue/attribute-hyphenation": "warn",
        "vue/v-on-event-hyphenation": "warn",
        "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
        "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",

        "vue/html-indent": [
          "error",
          2,
          {
            baseIndent: 1,
            ignores: [],
          },
        ],
      },
    },
    checker: {
      lintOnStart: true,
      formatter: "stylish",
    },
    fix: process.env.NODE_ENV === "development",
    cache: true,
  },

  css: [
    "~/assets/styles/main.scss",
    "~/assets/styles/variables/_z-index.scss",
    "~/assets/styles/variables/_colors.scss",
  ],
  postcss: {
    plugins: {
      "@tailwindcss/postcss": {},
      autoprefixer: {},
    },
  },

  googleFonts: {
    families: {
      Montserrat: [400, 500, 600, 700],
      // Можно добавить другие шрифты
    },
    display: "swap",
  },

  icon: {
    customCollections: [
      {
        prefix: "",
        dir: "./app/assets/icons",
      },
    ],
  },

  ui: {
    notifications: {
      variants: {
        "custom-error": {
          color: "red",
          ui: {
            background: "bg-[#991b1b]",
            title: "text-white font-bold",
            description: "text-rose-100",
          },
        },
      },
    },
  },

  toast: {
    position: "top-right",
    register: [
      {
        name: "custom-error",
        options: {
          icon: "error",
          type: "error",
          style: {
            background: "#991b1b",
            color: "#fff",
            borderLeft: "4px solid #b19364",
          },
        },
      },
    ],
  },

  routeRules: {
    "/": { prerender: true, static: true },
    "/assets/**": {
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
    "/_nuxt/**": {
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
    "/api/**": {
      cors: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    },
  },

  vite: {
    build: {
      target: "esnext",
      minify: "esbuild",
      cssMinify: true,
      terserOptions: {
        compress: {
          drop_console: process.env.NODE_ENV === "production",
          drop_debugger: true,
        },
      },
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ["vue", "pinia", "vue-router"],
            ui: ["@headlessui/vue"],
          },
        },
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    },
    plugins: [svgLoader({ svgo: false })],
    css: {
      devSourcemap: true,
      modules: {
        generateScopedName: "[name]__[local]___[hash:base64:5]",
      },
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use "sass:math";
            @use "~/assets/styles/tools/functions" as *;
            @use "~/assets/styles/variables" as *;
          `,
        },
      },
    },
  },

  optimizeDeps: {
    include: ["@headlessui/vue", "truncate-html"],
    exclude: ["@nuxt/ui"],
  },
});
