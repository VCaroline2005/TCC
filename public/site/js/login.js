(function () {
  function setPressed(btn, pressed) {
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false')
    btn.setAttribute('aria-label', pressed ? 'Ocultar senha' : 'Mostrar senha')
  }

  document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
    const selector = btn.getAttribute('data-toggle-password')
    const input = selector ? document.querySelector(selector) : null
    if (!input) return

    setPressed(btn, false)

    btn.addEventListener('click', function () {
      const isPassword = input.getAttribute('type') === 'password'
      input.setAttribute('type', isPassword ? 'text' : 'password')
      setPressed(btn, isPassword)
      input.focus()
      try {
        const len = input.value.length
        input.setSelectionRange(len, len)
      } catch (_) {
        // ignore
      }
    })
  })
})()

