import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import viteCompression from "vite-plugin-compression"; // 压缩插件
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  // server: {
  //   // port:5173,
  //   proxy: {
  //     ['/api']: {
  //       target: env.VITE_PROXY_TARGET,
  //       changeOrigin: true,
  //       rewrite: (path) => path.replace(new RegExp(`^${env.VITE_API_BASE_URL}`), ""),
  //     },
  //   },
  // },
  plugins: [
    vue(),
    vueDevTools(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240, // 超过 10kb 则压缩
      algorithm: "gzip",
      ext: ".gz",
    }),
    // PWA 离线配置
    VitePWA({
      registerType: "autoUpdate", // 自动更新 Service Worker
      workbox: {
        // 关键：将所有静态资源包含在预缓存列表中
        globPatterns: ["**/*.{js,css,html,ico,png,svg,gz}"],
        // 如果你的图片很大（如那张 4.8MB 的），需要调大缓存限制
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "我的 Vue 框架项目",
        short_name: "VueFrame",
        description: "支持离线使用的工程化项目",
        theme_color: "#ffffff",
        icons: [
          {
            src: "favicon.ico",
            sizes: "64x64",
            type: "image/x-icon",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
