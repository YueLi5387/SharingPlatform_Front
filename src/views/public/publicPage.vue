<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import { ref } from 'vue'
// import type { UploadProps } from 'element-plus'
import type { UploadProps } from 'element-plus'
import { addArticleService } from '@/api/article'

// 表单
const ruleFormRef = ref()
const formData = ref<{
  title: string
  imgURL: string
  content: string
}>({
  title: '',
  imgURL: '',
  content: ''
})
// 校验规则
const rules = {
  title: [
    { required: true, message: '请输入文章标题', trigger: 'blur' }
  ],
  imgURL: [
    { required: true, message: '请上传文章封面', trigger: 'change' }
  ],
  content: [
    { required: true, message: '请输入文章内容', trigger: 'blur' }
  ]
}
//图片上传
const handleChange: UploadProps['onChange'] = (uploadFile) => {
  formData.value.imgURL = URL.createObjectURL(uploadFile.raw as Blob);
  console.log(formData.value.imgURL);
}

// 提交表单
const submitForm = async () => {
  await ruleFormRef.value.validate()
  console.log(formData.value);
  //转变为FormData格式
  const fd = new FormData()
  for (const key in formData.value) {
    console.log(key);

    fd.append(key, (formData.value as Record<string, string>)[key])
  }
  console.log("fd:", fd);
  const res = await addArticleService(fd)


}
</script>

<template>
  <div class="public">
    <el-card class="content">
      <el-form ref="ruleFormRef" :model="formData" :rules="rules" label-width="100px" status-icon>
        <el-form-item label="文章标题" prop="title">
          <el-input v-model="formData.title" placeholder="请输入标题" maxlength="15" show-word-limit />
        </el-form-item>
        <!-- 图片 -->
        <el-form-item label="文章封面" prop="imgURL">
          <el-upload :show-file-list="false" class="avatar-uploader" :auto-upload="false" @change="handleChange">
            <img v-if="formData.imgURL" :src="formData.imgURL" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon">
              <Plus />
            </el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item label="文章内容" prop="content">
          <div class="editor">
            <QuillEditor theme="snow" v-model:content="formData.content" contentType="html">
            </QuillEditor>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitForm" size="large" style="width:150px;">提交</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
<style lang="less" scoped>
.public {
  width: 100%;
  // height: 700px;

  .content {
    width: 700px;
    height: 100%;

    // 图像
    :deep(.avatar-uploader) {
      .avatar {
        width: 178px;
        height: 178px;
        display: block;
      }

      .el-upload {
        border: 1px dashed var(--el-border-color);
        border-radius: 6px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: var(--el-transition-duration-fast);
      }

      .el-upload:hover {
        border-color: var(--el-color-primary);
      }
    }

    .el-icon.avatar-uploader-icon {
      font-size: 28px;
      color: #8c939d;
      width: 178px;
      height: 178px;
      text-align: center;
    }

    .editor {
      width: 100%;

      :deep(.ql-editor) {
        min-height: 300px;
      }
    }

  }
}
</style>