<script setup lang="ts">
/** 通用危险操作确认弹窗：清除密钥 / 清除文档 / 恢复备份等二级确认统一使用 */
withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    /** true 时确认按钮用红色危险色，否则用主色绿 */
    danger?: boolean
  }>(),
  { confirmText: '确认', cancelText: '取消', danger: false },
)
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()
</script>

<template>
  <teleport to="body">
    <div v-if="open" class="confirm-overlay" @click.self="emit('cancel')">
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <header class="cd-head">
          <span class="cd-title">{{ title }}</span>
          <button class="cd-close" title="关闭" @click="emit('cancel')">×</button>
        </header>
        <p class="cd-message">{{ message }}</p>
        <footer class="cd-foot">
          <button class="cd-cancel" @click="emit('cancel')">{{ cancelText }}</button>
          <button class="cd-confirm" :class="{ danger }" @click="emit('confirm')">{{ confirmText }}</button>
        </footer>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.confirm-overlay{position:fixed;inset:0;z-index:260;display:grid;place-items:center;padding:24px;background:rgba(21,30,26,.44);backdrop-filter:blur(3px)}.confirm-dialog{width:min(400px,100%);border:1px solid #dce4df;border-radius:12px;background:#fff;box-shadow:0 24px 70px rgba(15,28,21,.24);overflow:hidden}.cd-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e5eae7}.cd-title{font-size:14px;font-weight:700;color:#35413b}.cd-close{width:28px;height:28px;border:0;border-radius:6px;background:#f3f5f4;color:#7d8882;font-size:16px;cursor:pointer}.cd-message{margin:0;padding:16px 18px;font-size:12.5px;line-height:1.7;color:#56635d}.cd-foot{display:flex;justify-content:flex-end;gap:8px;padding:0 18px 16px}.cd-cancel{height:32px;padding:0 15px;border:1px solid #dfe5e1;border-radius:7px;background:#fff;color:#66716b;font-weight:650;cursor:pointer}.cd-cancel:hover{background:#f5f7f6}.cd-confirm{height:32px;padding:0 15px;border:1px solid #08a95b;border-radius:7px;background:#08a95b;color:#fff;font-weight:650;cursor:pointer}.cd-confirm:hover{opacity:.92}.cd-confirm.danger{border-color:#c44d43;background:#c44d43}
</style>
