export default {
  beforeCreate() {
    // 取出 SFC 文件路径（dev 模式下存在）
    const file =
      (this as any)?.$?.type?.__file ||
      (this as any)?.$vnode?.type?.__file ||
      (this as any)?.$options?.__file ||
      "";
    // 只统计 src/views 目录下的页面组件，避免大量内部组件干扰
    if (!file || (file.indexOf("/views/") === -1 && file.indexOf("\\views\\") === -1)) {
      return;
    }

    const name = (this as any)?.$options?.name || file.split(/[\\/]/).pop() || "anonymous-page";
    const label = `[PAGE] ${name}`;

    // 保存 label 到实例上，mounted 时结束
    (this as any).__auto_count_label = label;
    // 开始计时并输出
    console.time(label);
  },

  mounted() {
    const label = (this as any).__auto_count_label;
    if (label) {
      console.timeEnd(label);
      delete (this as any).__auto_count_label;
    }
  },
};
