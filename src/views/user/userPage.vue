<template>
<div class="user">
    <el-card class="userInfo"></el-card>
  <el-card class="setting"></el-card>
</div>
</template>
<style lang="less" scoped>
  .user {
    height: 100%;
    display: flex;
    justify-content: space-between;
    .userInfo,.setting {
      width: 45%;
      background-color: pink;
    }
  }
</style>