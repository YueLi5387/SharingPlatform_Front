import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      component: () => import("@/views/login/loginPage.vue"),
    },
    {
      path: "/",
      component: () => import("@/views/layout/layoutPage.vue"),
      redirect: "/login",
      children: [
        { path: "/home", component: () => import("@/views/home/homePage.vue") },
        { path: "/user", component: () => import("@/views/user/userPage.vue") },
        { path: "/public", component: () => import("@/views/public/publicPage.vue") },
      ],
    },
  ],
});

export default router;
