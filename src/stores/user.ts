import { defineStore } from "pinia";
import { ref } from "vue";

export const useUserStore = defineStore(
  "user",
  () => {
    const username = ref("");
    const password = ref();
    const remember = ref(false);
    return {
      username,
      password,
      remember,
    };
  },
  {
    persist: true,
  }
);
