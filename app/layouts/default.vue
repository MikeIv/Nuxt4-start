<script setup lang="ts">
  const isCollapsed = ref(false);
</script>

<template>
  <div :class="[$style.layout, { [$style.collapsed]: isCollapsed }]">
    <section :class="$style.sidebar">
      <CoreSidebar />
    </section>
    <section :class="$style.header">
      <CoreHeader />
    </section>
    <main :class="$style.main" role="main">
      <section :class="$style.content">
        <NuxtPage v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </NuxtPage>
      </section>
    </main>
  </div>
</template>

<style module lang="scss">
  .layout {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      "sidebar header"
      "sidebar content";
    height: 100vh;
    transition: grid-template-columns 0.3s ease;
  }

  .layout.collapsed {
    grid-template-columns: 80px 1fr;
  }

  .sidebar {
    grid-area: sidebar;
    display: flex;
    flex-direction: column;
    max-width: 400px;
    background: var(--a-bgAccentLight);
    padding: 0 0 0 rem(40);
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .header {
    grid-area: header;
    background: #e0e0e0;
    padding: 0;
  }

  .main {
    grid-area: content;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: rem(18) rem(34);
    overflow: hidden;
  }

  .content {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: auto;

    &::-webkit-scrollbar {
      width: rem(6);
    }

    &::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }
</style>
