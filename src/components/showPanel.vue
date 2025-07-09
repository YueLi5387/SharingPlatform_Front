<script setup lang="ts">
import { LazyImg, Waterfall } from 'vue-waterfall-plugin-next'
import 'vue-waterfall-plugin-next/dist/style.css'

type listType = {
  id: number,
  title: string,
  url: string,
  content: string
}
const props = defineProps<{ articleList: listType[] }>()
const articleList = [...props.articleList]
// 移动端配置（详细看文档）
const breakpoints = {
  1500: {
    // when wrapper width < 1200
    rowPerView: 5,
  },
  1200: {
    rowPerView: 4
  },
  900: {
    // when wrapper width < 800
    rowPerView: 3,
  },
  600: {
    // when wrapper width < 500
    rowPerView: 2,
  },
  400: {
    rowPerView: 1
  }
}
</script>
<template>
  <div class="showPanel">
    <Waterfall :list="articleList" :breakpoints="breakpoints" :gutter="20">

      <template #default="{ item }">
        <div class="card">
            <LazyImg :url="item.url" alt="" class="pic" />
          <p class="title">{{ item.content }}</p>
        </div>
      </template>
    </Waterfall>
  </div>
</template>

<style scoped lang="less">
.showPanel {
  height: 100%;
  .pic {
    border: 1px solid rgb(220, 220, 220);
    border-radius: 20px;
  }
}
</style>