<script setup lang="ts">
import { ref, nextTick, onUnmounted } from 'vue'
import { io } from "socket.io-client";
import { useUserStore } from '@/stores/user';
import { da } from 'element-plus/es/locales.mjs';
import type { ChatMessageType } from '@/types/user';
const userStore = useUserStore()
const socket = io("http://localhost:8080");
let listIdCounter = -1;// 用于生成唯一ID
socket.on("connect", () => {
  console.log("前端连接成功");
  //发送加入房间事件
  socket.emit('join', userStore.userId);
  //获取先前的信息
  socket.on('previousMsg', preMsgList => {
    preMsgList.forEach((item: any) => {
      messages.value.push({
        text: item.msg,
        side: item.user_id === userStore.userId ? 'right' : 'left',
        userId: item.user_id,
        date: item.date,
        listId: item.chat_id,
        name: item.username
      })
    });
    //往后端发个消息，告诉它我收到了之前的信息，可以发送欢迎信息了
    socket.emit('receivedPreMsg');
  });
  //监听欢迎信息  --但是有风险，如果网速不行可能会出现欢迎信息在前面的问题信息后面的情况
  socket.on('welcome', (name, userId) => {
    if (userId !== userStore.userId) {
      messages.value.push({ text: `用户 ${name} 加入了聊天`, side: 'middle', userId, date: '', listId: listIdCounter--, name: '系统' })
      scrollToBottom()
    } else {
      messages.value.push({ text: `欢迎来到聊天室`, side: 'middle', userId, date: '', listId: listIdCounter--, name: '系统' })
      scrollToBottom()
    }
  })
  //监听消息
  socket.on('message', (name, text, date, userId, listId) => {
    const side = userId === userStore.userId ? 'right' : 'left'
    messages.value.push({ text, side, userId, date, listId, name })
    scrollToBottom()
  })
  //监听离开信息
  socket.on('leave', (userId, name) => {
    messages.value.push(
      {
        text: `用户 ${name} 离开了聊天`,
        side: 'middle',
        userId,
        date: '',
        listId: listIdCounter--,
        name: '系统'
      }
    )
    scrollToBottom()
  })
});

//信息总列表
const messages = ref<Array<ChatMessageType>>([
])

const inputText = ref('')

const containerRef = ref<HTMLElement | null>(null)

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()//为什么？ -- 因为Vue是异步更新DOM的，往 messages 里添加新消息后，DOM 不会立刻更新，此时获取 scrollHeight 是 “旧高度”，滚动就不准确，所以下一次DOM更新完成后再滚动
  const el = containerRef.value
  if (el) el.scrollTop = el.scrollHeight
}

const sendMessage = () => {
  const text = inputText.value.trim()
  if (!text) return
  // 发送消息到服务器
  socket.emit('message', text, new Date().toLocaleString());
  inputText.value = ''
  scrollToBottom()
}
onUnmounted(() => {
  socket.disconnect();// 组件卸载时断开连接
})
</script>

<template>
  <div class="chatPage">
    <div class="chat-main">
      <div class="messages" ref="containerRef">
        <div v-for="item in messages" :key="item.listId" :class="['msg', item.side]">
          <template v-if="item.side !== 'middle'">
            <div class="meta username">{{ item.name }}</div>
            <div class="bubble">{{ item.text }}</div>
            <div class="meta time">{{ item.date }}</div>
          </template>
          <template v-else>
            <div class="bubble">{{ item.text }}</div>
          </template>
        </div>
      </div>
    </div>

    <div class="chat-footer">
      <textarea v-model="inputText" placeholder="请友善发言，维护社区和谐" />
      <button class="send-btn" @click="sendMessage">发送</button>
    </div>
  </div>
</template>

<style scoped lang="less">
.chatPage {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 14px;
  box-sizing: border-box;

  .chat-main {
    flex: 1 1 auto;
    display: flex;
    align-items: stretch;

    .messages {
      width: 100%;
      padding: 18px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .msg {
        display: flex;
        flex-direction: column;
        gap: 6px;

        &.left {
          align-items: flex-start;
        }

        &.right {
          align-items: flex-end;
        }

        /* 中间欢迎语样式 */
        &.middle {
          align-items: center;

          .bubble {
            background: transparent;
            color: #9aa6b0;
            font-size: 12px;
            padding: 6px 8px;
            border-radius: 4px;
            box-shadow: none;
            border: none;
          }
        }

        .meta {
          max-width: 72%;
          padding: 0 8px;
          line-height: 1;
        }

        .meta.username {
          font-size: 12px;
          color: #6b7a82;
          margin-bottom: 4px;
          font-weight: 600;
        }

        .bubble {
          max-width: 72%;
          padding: 10px 14px;
          border-radius: 8px;
          line-height: 1.4;
          word-break: break-word;
          box-shadow: 0 2px 6px rgba(10, 20, 30, 0.04);
        }

        .meta.time {
          font-size: 12px;
          color: #9aa6b0;
          margin-top: 4px;
        }

        &.left {
          .bubble {
            background: #ffffff;
            color: #222b33;
            border: 1px solid #e6e9ec;
            border-top-left-radius: 4px;
          }
        }

        &.right {
          .bubble {
            background: #dcf8c6;
            color: #1a2b16;
            border-top-right-radius: 4px;
          }
        }
      }
    }
  }

  .chat-footer {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    padding: 12px 4px 4px 4px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    background: rgba(255, 255, 255, 0.6);

    textarea {
      flex: 1 1 auto;
      min-height: 44px;
      max-height: 140px;
      resize: none;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid #d9e0e6;
      background: #fff;
      font-size: 14px;
      line-height: 1.4;
      outline: none;
    }

    .send-btn {
      min-width: 76px;
      height: 44px;
      padding: 0 14px;
      border-radius: 6px;
      border: none;
      background: linear-gradient(180deg, #2dbf64, #24a34f);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
  }

  @media (max-width: 720px) {
    .chat-main {
      .messages {
        .bubble {
          max-width: 86%;
        }
      }
    }

    .chat-footer {
      .send-btn {
        min-width: 64px;
      }
    }
  }
}
</style>