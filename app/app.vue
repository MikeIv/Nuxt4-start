<template>
  <UApp :toaster="toaster">
    <NuxtLayout>
      <NuxtPage />

      <NuxtRouteAnnouncer />
    </NuxtLayout>
  </UApp>
</template>

<script setup>
  useHead({
    titleTemplate: (title) => (title ? `${title} | ЛК` : "Личный кабинет"),
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { hid: "description", name: "description", content: "ЛК" },
      { name: "theme-color", content: "#ffffff" },
    ],
    link: [
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    ],
    bodyAttrs: {
      class: "min-h-screen bg-gray-50",
    },
  });

  const toaster = { duration: 7000 };
</script>

<style>
  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: "Montserrat", sans-serif;
  }
</style>
