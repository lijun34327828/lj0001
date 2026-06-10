import { ref, getCurrentInstance } from 'vue'

const instance = getCurrentInstance()
const warnDialogRef = ref(null)

export function useBudgetWarning() {
  const getDialog = () => {
    if (warnDialogRef.value) return warnDialogRef.value
    const app = instance?.appContext?.app
    if (app) {
      return app.config.globalProperties.$budgetWarning
    }
    return null
  }

  function showBudgetWarning(warning, options) {
    const dialog = getDialog()
    if (dialog) {
      return dialog.showWarning(warning, options)
    }
    return Promise.resolve(true)
  }

  return {
    warnDialogRef,
    showBudgetWarning
  }
}
