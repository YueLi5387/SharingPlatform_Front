<script setup lang="ts">
import showPanel from '@/components/showPanel.vue';
import { getArticleList } from '@/api/article';
import { onMounted, ref } from 'vue';

const list = ref([])
const getList = async () => {
  const res = await getArticleList()
  list.value = res.data  
}

onMounted(() => { getList() })
const obj = {
  list:list.value
}

</script>
<template>
  <div class="home">
    <showPanel :list="list" :isUser="false" ></showPanel>
  </div>
</template>
<style lang="less" scoped>
.home {
  height: 100%;
}
</style>