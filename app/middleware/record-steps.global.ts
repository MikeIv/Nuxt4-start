export default defineNuxtRouteMiddleware((to, from) => {
  if (to.name === "record-step") {
    const step = to.params.step;

    // Если пользователь пришёл напрямую и шаг не 1 -> перенаправление на 1
    if (!from.name && step !== "1") {
      return navigateTo({ name: "record-step", params: { step: "1" } });
    }
  }
});
