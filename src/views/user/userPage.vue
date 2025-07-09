<script setup lang="ts">
import { useUserStore } from '@/stores/user';
import { ref, reactive } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'


const userStore = useUserStore()

// 修改个人资料
const formRef = ref<FormInstance>()
type FormModel = {
  username: string,
  password: string,
  repassword: string
}
const formModel = ref<FormModel>({
  username: '',
  password: '',
  repassword: ''
})
const checkPassword = (rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (value !== formModel.value.password) {
    callback(new Error('两次密码不一致'))
  } else {
    callback()
  }
}
const rules = reactive<FormRules<FormModel>>({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 14, message: '密码长度为 6-14 个字符', trigger: 'blur' }
  ],
  repassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: checkPassword, trigger: 'blur' }
  ]
})
const confirm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate()
  userStore.username = formModel.value.username
  userStore.password = formModel.value.password
  ElMessage.success('修改成功！')
  formModel.value = {
    username: '',
    password: '',
    repassword: ''
  }
}

</script>
<template>
  <div class="user">
    <div class="left">
      <div class="userinfo">
        <div class="pic">
          <img :src="userStore.userPic" alt="">
        </div>
        <div class="info">
          <p style="font-size: 20px;color: #545151;">{{ userStore.username }}</p>
          <p style="font-size: 15px;">{{ userStore.password }}</p>
        </div>
      </div>
    </div>
    <el-card class="right">
      <template #header>
        <div class="card-header">
          <h2>修改个人资料</h2>
        </div>
      </template>
      <el-form ref="formRef" :model="formModel" :rules="rules" status-icon size="large">
        <el-form-item prop="username">
          <el-input v-model="formModel.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="formModel.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item prop="repassword">
          <el-input v-model="formModel.repassword" type="password" placeholder="请再次输入密码" />
        </el-form-item>

        <el-form-item>
          <el-button style="width: 100%; margin-top: 20px" type="primary" @click="confirm(formRef)">确认</el-button>
        </el-form-item>

      </el-form>
    </el-card>
  </div>
</template>
<style lang="less" scoped>
.user {
  height: 100%;
  display: flex;
  justify-content: space-between;
  padding: 0px 20px;

  .left,
  .right {
    width: 500px;
    height: 100%;
  }

  .left {
    height: 100%;
    padding-top: 10%;
    line-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;

    .pic {
      width: 300px;
      height: 300px;
      border-radius: 50%;
      border: 1px solid #ddb8b8;

      img {
        width: 100%;
        border-radius: 50%;
      }

      margin-bottom: 25px;
    }

    .info {
      text-align: center;

      p {
        color: #878787;
        margin-bottom: 10px;
      }
    }
  }
  .right {
    .card-header {
      text-align: center;
    }
  }
}
</style>