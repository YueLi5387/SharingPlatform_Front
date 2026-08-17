<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import { onBeforeUnmount, ref, toRaw, watch } from 'vue'
import type { QuillEditor as QuillEditorType } from '@vueup/vue-quill';
import { ElMessage, type UploadProps } from 'element-plus'
import { addArticleService, addArticleVideoService, addLargeFileArticleService, checkFileRequest, editArticleService, editLargeFileArticleService, mergeRequest } from '@/api/article'
import { useUserStore } from '@/stores/user'
import SparkMD5 from 'spark-md5'
import type { FileChunkType } from '@/types/user'

type currentDetailInfoType = {
  user_pic: string,
  username: string,
  user_id: number,
  id: number,
  title: string,
  url: string,
  content: string,
}

type WorkerChunkType = {
  index: number
  blob: Blob
  hash: string
}

type MessageResponse = {
  message: string
}

// 接口拦截器会把成功提示挂到返回值的 message 上，这里统一取出它。
const getMessage = (res: unknown) => (res as MessageResponse).message

const props = defineProps<{ panelType: string, currentDetailInfo?: currentDetailInfoType }>()

const fullscreenLoading = ref(false)//loading

// 表单
const ruleFormRef = ref()
const formData = ref<{
  // id?: number
  title: string
  imgURL: Blob
  content: string
}>({
  // id: 0,
  title: '',
  imgURL: new Blob(),
  content: ''
})
// 校验规则
// 编辑器要特殊判空，可能是它组件设计问题，一旦输入内容后再删除，值变为"<p><br></p>"，而不是""
const checkNull = (rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value.trim() || value === '<p><br></p>') {
    return callback(new Error('请输入文章内容'))
  }
  callback()
}
const rules = {
  title: [
    { required: true, message: '请输入文章标题', trigger: 'blur' }
  ],
  imgURL: [
    { required: true, message: '请上传文章封面', trigger: 'change' }
  ],
  content: [
    // { required: true, message: '请输入文章内容', trigger: 'blur' },
    { validator: checkNull, trigger: 'blur' }
  ]
}
// 编辑器失焦时校验，因为QuillEditor 没有原生blur事件，所以自定义一个
const onEditorBlur = () => {
  ruleFormRef.value?.validateField('content')
}

//文件上传（图片or视频）
const backupURL = ref('')//图片回显
const isPic = ref(true)//是否是图片
const videoUploadFile = ref()//视频文件
const handleChange: UploadProps['onChange'] = (uploadFile) => {
  console.log('uploadFile:', uploadFile);
  if (uploadFile.raw!.type.startsWith('image/')) {
    isPic.value = true
    formData.value.imgURL = uploadFile.raw as Blob
  } else {
    isPic.value = false
    videoUploadFile.value = uploadFile.raw
  }
  const fr = new FileReader();
  fr.readAsDataURL(uploadFile.raw as Blob);
  fr.onload = () => {
    backupURL.value = fr.result as string;
  };
}

// 设置编辑器
const editor = ref<InstanceType<typeof QuillEditorType> | null>(null)

const userStore = useUserStore()

// --- 多标签页上传协同 ---
const uploadChannel = new BroadcastChannel('file_upload_sync');
const LOCK_EXPIRE_TIME = 10000 // 心跳超过 10 秒未收到，视为锁已过期
const HEARTBEAT_INTERVAL = 3000 // 上传页每 3 秒同步一次状态
// 记录其他标签页正在上传的文件 Hash 和过期时间
const remoteUploadingHashes = ref(new Map<string, number>());
let heartbeatTimer: number | undefined
let currentUploadingHash: string | null = null
let isUploadChannelClosed = false

uploadChannel.onmessage = (event) => {
  // 其他标签页发来“开始上传”或“心跳”时，刷新该文件的状态有效期。
  const { type, fileHash, expiresAt } = event.data;
  if (type === 'UPLOAD_START' || type === 'UPLOAD_HEARTBEAT') {
    remoteUploadingHashes.value.set(fileHash, expiresAt);
  }
  if (type === 'UPLOAD_END') remoteUploadingHashes.value.delete(fileHash);
};

// 判断其他标签页是否仍在上传该文件；超时的旧状态会在这里顺手清理。
const isRemoteUploading = (fileHash: string) => {
  const expiresAt = remoteUploadingHashes.value.get(fileHash)
  if (!expiresAt) return false
  if (expiresAt <= Date.now()) {
    remoteUploadingHashes.value.delete(fileHash)
    return false
  }
  return true
}

// 当前标签页拿到浏览器锁后调用：先通知其他标签页，再定时发送心跳续期。
const startUploadHeartbeat = (fileHash: string) => {
  if (isUploadChannelClosed) return
  currentUploadingHash = fileHash
  // 每条状态消息都带新的过期时间，接收方不用维护额外的定时器。
  const syncUploadStatus = (type: 'UPLOAD_START' | 'UPLOAD_HEARTBEAT') => {
    uploadChannel.postMessage({
      type,
      fileHash,
      expiresAt: Date.now() + LOCK_EXPIRE_TIME,
    })
  }
  syncUploadStatus('UPLOAD_START')
  heartbeatTimer = window.setInterval(() => syncUploadStatus('UPLOAD_HEARTBEAT'), HEARTBEAT_INTERVAL)
}

// 结束上传时调用：停止心跳，并让其他标签页立即移除该文件的上传状态。
const stopUploadHeartbeat = (fileHash: string) => {
  if (heartbeatTimer !== undefined) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = undefined
  }
  if (!isUploadChannelClosed) {
    uploadChannel.postMessage({ type: 'UPLOAD_END', fileHash })
  }
  currentUploadingHash = null
}

// 组件销毁时主动清理定时器和频道，防止组件卸载后继续发送消息。
onBeforeUnmount(() => {
  if (currentUploadingHash) stopUploadHeartbeat(currentUploadingHash)
  isUploadChannelClosed = true
  uploadChannel.close()
})
// -----------------------

// 大文件分片上传
const CHUNK_SIZE = 1024 * 1024  // 1MB
const fileChunksList = ref<Blob[]>([])//原始分片数组
const fileDetailList = ref<FileChunkType[]>([])//分片详细信息数组



const uploadToBehind = async (existChunks: string[] = []) => {
  // 构造FormDatas数组
  const formDatas = fileDetailList.value
    .filter((item) => {
      // 过滤服务器上已经有的切片
      return !existChunks.includes(item.chunkIndex)
    })
    .map(item => {
      const formData = new FormData()
      formData.append('fileHash', item.fileHash)
      formData.append('chunkIndex', item.chunkIndex)
      formData.append('chunk', item.chunk)
      formData.append('fileName', item.fileName)
      return formData
    })
  // 发送请求
  const maxCount = 6; // 最大并发数
  const total = formDatas.length;
  if (total === 0) return; // 如果没有需要上传的切片，直接跳过

  let completedCount = 0; // 已完成任务数
  let isError = false; // 是否发生错误（用于熔断）
  let resolveAll: () => void = () => {}
  let rejectAll: (reason?: unknown) => void = () => {}
  const allDone = new Promise<void>((resolve, reject) => {
    resolveAll = resolve;
    rejectAll = reject;
  });

  //  构建“待执行任务队列”
  const taskQueue = formDatas.map((item) => {
    // 封装单个分片上传任务
    return async function uploadTask(retry = 3): Promise<void> {
      if (isError) return;

      try {
        await addArticleVideoService(item);
        completedCount++;
        // 成功后，所有任务完成则 resolve
        if (completedCount === total) {
          resolveAll();
        }
      } catch {
        if (retry > 0) {
          // 还有重试机会，重新执行当前任务
          return uploadTask(retry - 1);
        } else {
          // 重试次数用完，触发熔断
          isError = true;
          rejectAll('发布失败，请检查网络连接');
          return;
        }
      } finally {
        // 任务完成后（无论成功还是重试失败），只要没发生熔断，就从队列取下一个任务补充
        if (!isError && taskQueue.length > 0) {
          const nextTask = taskQueue.shift();
          if (nextTask) nextTask();
        }
      }
    };
  });

  // 3. 启动初始任务
  for (let i = 0; i < maxCount && taskQueue.length > 0; i++) {
    const task = taskQueue.shift();
    if (task) {
      task();
    }
  }

  // 4. 等待所有任务完成
  try {
    await allDone;
  } catch (err) {
    console.error(err);
    ElMessage.error(typeof err === 'string' ? err : '发布失败，请检查网络连接');
    fullscreenLoading.value = false;
    return; // 发生错误，终止后续合并和添加文章逻辑
  }
  // console.log('所有分片上传完成');

  // 发送切片合并请求
  await mergeRequest({
    size: CHUNK_SIZE,
    fileHash: fileDetailList.value[0].fileHash,
    fileName: fileDetailList.value[0].fileName,
  })

  // 合并完成后添加文章
  if (props.panelType === 'public') {
    const res = await addLargeFileArticleService({
      fileHash: fileDetailList.value[0].fileHash,
      fileName: fileDetailList.value[0].fileName,
      title: formData.value.title,
      user_id: userStore.userId,
      content: formData.value.content,
    })
    ElMessage.success(getMessage(res))
  }
  else {
    // 编辑文章
    const res = await editLargeFileArticleService({
      fileHash: fileDetailList.value[0].fileHash,
      fileName: fileDetailList.value[0].fileName,
      title: formData.value.title,
      user_id: userStore.userId,
      content: formData.value.content,
      id: props.currentDetailInfo!.id
    })
    ElMessage.success(getMessage(res))
    window.location.reload()
  }
  formData.value = { title: '', imgURL: new Blob(), content: '' }
  backupURL.value = '' // 清空图片回显
  editor.value?.setHTML('')//清空编辑器内容
  return
}


// 秒传
const verify = async (fileHash: string, fileName: string) => {
  const res = await checkFileRequest({
    fileHash,
    fileName,
  })
  return res.data
}

const videoUpload = async () => {
  // console.log('开始上传：', new Date());
  // console.time('分片+hash时间');

  fullscreenLoading.value = true

  try {
    fileChunksList.value = [] // 清空分片数组
    const rawValue = toRaw(videoUploadFile.value)//作用：获取原始文件对象，避免响应式代理
    // console.log(rawValue)

    //把分片任务分配给 THREAD_COUNT 个 worker，每个 worker 负责一段索引区间
    const totalFileSize = rawValue.size // 文件总大小
    const chunkCount = Math.ceil(totalFileSize / CHUNK_SIZE)
    const THREAD_COUNT = Math.min(navigator.hardwareConcurrency || 4, chunkCount)// 使用核心数和分片数的较小值作为线程数

    // 创建多个 worker，分配分片计算任务，收集结果并扁平化返回
    const cutFile = (file: File) => {
      return new Promise<WorkerChunkType[]>((resolve, reject) => {
        const result: WorkerChunkType[][] = []
        let finishCount = 0
        for (let i = 0; i < THREAD_COUNT; i++) {
          const worker = new Worker(new URL('../util/worker.js', import.meta.url), { type: 'module' })
          // 计算该 worker 负责的分片区间
          const start = Math.floor((i * chunkCount) / THREAD_COUNT)
          let end = Math.floor(((i + 1) * chunkCount) / THREAD_COUNT)
          if (end > chunkCount) end = chunkCount

          worker.postMessage({ file, CHUNK_SIZE, start, end })
          worker.onmessage = (e: MessageEvent) => {
            // worker 返回一个数组（该区间的 chunk 列表）
            result[i] = e.data as WorkerChunkType[]
            worker.terminate()
            finishCount++
            if (finishCount === THREAD_COUNT) {
              // 扁平化并返回
              resolve(result.flat())
            }
          }
          worker.onerror = () => {
            worker.terminate()
            reject('文件解析失败，请检查网络连接')
          }
        }
      })
    }

    // 调用 cutFile 获取所有 chunk 对象（每个对象包含 index, blob, hash）
    const chunks = await cutFile(rawValue as File)
    // 按 index 排序            --1.25:这个排序似乎是多余的
    chunks.sort((a, b) => a.index - b.index)

    // 用每个分片的 hash 拼接后再计算整体 hash（避免在主线程读大量 ArrayBuffer）
    const spark = new SparkMD5()
    for (const c of chunks) {
      spark.append(c.hash)
    }
    const fileHash = spark.end()

    // 只有拿到 navigator.locks 锁的标签页才会进入这里，避免重复调用后端接口。
    const uploadFile = async () => {
      startUploadHeartbeat(fileHash)
      try {

        // 把 blob 列表赋给 fileChunksList 保持原逻辑不变
        fileChunksList.value = chunks.map(c => c.blob)
        // console.log('fileHash', fileHash)
        console.timeEnd('分片+hash时间')


    // 秒传   ---如果改文件已经上传过就不再上传分片，直接添加文章
        const data = await verify(fileHash as string, rawValue.name)
        const isExists = data.isExists
        if (isExists) {
      //添加文章
      if (props.panelType === 'public') {
        const res = await addLargeFileArticleService({
          fileHash: fileHash,
          fileName: rawValue.name,
          title: formData.value.title,
          user_id: userStore.userId,
          content: formData.value.content,
        })
        // console.log('成功添加', res);
        fullscreenLoading.value = false
        ElMessage.success(getMessage(res))
      } else {
        // 编辑文章
        const res = await editLargeFileArticleService({
          fileHash: fileHash,
          fileName: rawValue.name,
          title: formData.value.title,
          user_id: userStore.userId,
          content: formData.value.content,
          id: props.currentDetailInfo!.id
        })
        fullscreenLoading.value = false
        window.location.reload()
        ElMessage.success(getMessage(res))

      }
      formData.value = { title: '', imgURL: new Blob(), content: '' }
      backupURL.value = '' // 清空图片回显
      editor.value?.setHTML('')//清空编辑器内容

      // 秒传成功，立即解锁
        } else {
      // 构造详细分片数组
      fileDetailList.value = fileChunksList.value.map((item, index) => {
        return {
          chunk: item, //分片内容
          fileHash: fileHash as string, //文件哈希，强制类型为string
          chunkIndex: `${fileHash}-${index}`, //分片索引哈希
          fileName: rawValue.name, //文件名
        }
      })
      // 上传视频切片
      await uploadToBehind(data.existChunks)

      // 上传完成，解锁
          fullscreenLoading.value = false
          // console.log('结束上传：', new Date());
        }
      } finally {
        // 无论成功、失败还是关闭页面，都通知其他标签页清除上传状态
        stopUploadHeartbeat(fileHash)
      }
    }

    // navigator.locks 会原子地完成“检查并占用锁”，避免两个标签页同时开始上传
    if ('locks' in navigator) {
      const didStart = await navigator.locks.request(
        `upload:${fileHash}`,
        { ifAvailable: true },
        async (lock) => {
          // lock 为 null 说明另一个标签页已拿到同一文件的锁；当前页面不排队，直接提示。
          if (!lock) return false
          await uploadFile()
          return true
        }
      )
      if (!didStart) {
        ElMessage.warning('检测到其他标签页正在上传此文件')
        fullscreenLoading.value = false
      }
    } else {
      // 旧浏览器没有 navigator.locks 时，降级使用 BroadcastChannel 状态判断
      if (isRemoteUploading(fileHash)) {
        ElMessage.warning('检测到其他标签页正在上传此文件')
        fullscreenLoading.value = false
        return
      }
      await uploadFile()
    }
  } catch (err) {
    console.error('上传出错:', err)
    ElMessage.error(typeof err === 'string' ? err : '上传失败，请检查网络连接')
    fullscreenLoading.value = false
  }
}

// 提交表单
const submitForm = async () => {
  await ruleFormRef.value.validate()
  // 如果是图像直接提交
  if (isPic.value) {
    fullscreenLoading.value = true
    //转变为FormData格式
    const fd = new FormData()
    for (const key in formData.value) {
      fd.append(key, (formData.value as unknown as Record<string, string | Blob>)[key])
    }
    fd.append('user_id', userStore.userId)//追加用户id
    // fd.append('isPic', String(isPic.value))//是否是图片
    //发布和编辑分开处理
    if (props.panelType === 'public') {
      await addArticleService(fd)
      fullscreenLoading.value = false
      ElMessage.success('新增成功!')
    }
    if (props.panelType === 'edit') {
      if (props.currentDetailInfo && props.currentDetailInfo.id !== undefined) {
        fd.append('id', String(props.currentDetailInfo.id))
        await editArticleService(fd)
        // console.log('res:', res);
        fullscreenLoading.value = false
        ElMessage.success('编辑成功!')
        // 刷新页面
        window.location.reload()
      }
    }

    formData.value = { title: '', imgURL: new Blob(), content: '' }
    // videoUploadFile.value = new File([], '') // 清空视频文件
    backupURL.value = '' // 清空文件回显
    editor.value?.setHTML('')//清空编辑器内容
  }
  // 如果是视频，使用大文件分片上传
  else {
    videoUpload()
  }
}

//props直接结构会丢失相应属性的响应式，而用watch可以监听到变化，为防止formData无法通过currentDetailInfo初始化，使用watch监听props变化
watch(() => props.currentDetailInfo, (newVal) => {
  if (newVal) {
    // 处理数据初始化
    Object.assign(formData.value, {
      title: newVal.title,
      content: newVal.content,
    })
  }
}, { immediate: true })
</script>

<template>
  <!-- 发布 -->
  <el-card class="content" v-if="panelType === 'public'">
    <el-form ref="ruleFormRef" :model="formData" :rules="rules" label-width="100px" status-icon>
      <el-form-item label="文章标题" prop="title">
        <el-input v-model="formData.title" placeholder="请输入标题" maxlength="15" show-word-limit />
      </el-form-item>
      <!-- 图片 -->
      <el-form-item label="文章配图" prop="imgURL">
        <div style="display: flex; align-items: flex-start;">
          <el-upload :show-file-list="false" class="avatar-uploader" :auto-upload="false" @change="handleChange">
            <template #trigger>
              <el-button type="primary" plain>上传文件</el-button>
            </template>
          </el-upload>
          <div class="avatar-show" style="margin-right: 16px;">
            <div class="avatar" v-if="backupURL">
              <img :src="backupURL" style="width: 100%;
              height: 100%;" v-if="isPic" />
              <video :src="backupURL" v-else style="width: 100%;
              height: 100%;" controls></video>
            </div>
            <el-icon v-else class="avatar-uploader-icon">
              <Plus />
            </el-icon>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="文章内容" prop="content">
        <div class="editor">
          <QuillEditor theme="snow" v-model:content="formData.content" contentType="html" ref="editor"
            @blur="onEditorBlur">
          </QuillEditor>
        </div>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitForm" size="large" style="width:150px;"
          v-loading.fullscreen.lock="fullscreenLoading">提交</el-button>
      </el-form-item>
    </el-form>
  </el-card>

  <!-- 编辑 -->
  <el-card class="content" v-if="panelType === 'edit'">
    <el-form ref="ruleFormRef" :model="formData" :rules="rules" label-width="100px" status-icon>
      <el-form-item label="文章标题" prop="title">
        <el-input v-model="formData.title" placeholder="请输入标题" maxlength="15" show-word-limit />
      </el-form-item>
      <!-- 图片 -->
      <el-form-item label="文章配图" prop="imgURL">
        <div style="display: flex; align-items: flex-start;">
          <el-upload :show-file-list="false" class="avatar-uploader" :auto-upload="false" @change="handleChange">
            <template #trigger>
              <el-button type="primary" plain>上传文件</el-button>
            </template>
          </el-upload>
          <div class="avatar-show" style="margin-right: 16px;">
            <div class="avatar" v-if="backupURL">
              <img :src="backupURL" style="width: 100%;
              height: 100%;" v-if="isPic" />
              <video :src="backupURL" v-else style="width: 100%;
              height: 100%;" controls></video>
            </div>
            <el-icon v-else class="avatar-uploader-icon">
              <Plus />
            </el-icon>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="文章内容" prop="content">
        <div class="editor">
          <QuillEditor theme="snow" v-model:content="formData.content" contentType="html" ref="editor"
            @blur="onEditorBlur">
          </QuillEditor>
        </div>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitForm" size="large" style="width:150px;"
          v-loading.fullscreen.lock="fullscreenLoading">提交</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>
<style lang="less" scoped>
// .public {
//   width: 100%;
// height: 700px;

.content {
  width: 100%;
  // width: 700px;
  height: 100%;

  // 图像
  // :deep(.avatar-uploader) {
  //   .avatar {
  //     width: 178px;
  //     height: 178px;
  //     display: block;
  //   }

  //   .el-upload {
  //     border: 1px dashed var(--el-border-color);
  //     border-radius: 6px;
  //     cursor: pointer;
  //     position: relative;
  //     overflow: hidden;
  //     transition: var(--el-transition-duration-fast);
  //   }

  //   .el-upload:hover {
  //     border-color: var(--el-color-primary);
  //   }
  // }

  .avatar-show {
    // .avatar {
    width: 178px;
    height: 178px;
    display: block;
    border: 1px dashed #cbcbcb;
    border-radius: 10px;
    margin-left: 20px;

    // }
    .avatar {
      width: 100%;
      height: 100%;
      display: block;
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

// }
</style>
