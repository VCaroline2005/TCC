(function () {
  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '')
  }

  function formatBRPhone(value) {
    const digits = digitsOnly(value)
    if (!digits) return ''

    // DDD + número (10 ou 11 dígitos)
    const ddd = digits.slice(0, 2)
    const rest = digits.slice(2)

    if (digits.length <= 2) return digits

    // Fixo: (DD) 1234-5678
    if (rest.length <= 8) {
      const p1 = rest.slice(0, 4)
      const p2 = rest.slice(4, 8)
      return `(${ddd}) ${p2 ? `${p1}-${p2}` : p1}`.trim()
    }

    // Móvel: (DD) 91234-5678
    const p1 = rest.slice(0, 5)
    const p2 = rest.slice(5, 9)
    return `(${ddd}) ${p2 ? `${p1}-${p2}` : p1}`.trim()
  }

  function attachMask(input) {
    if (!input) return

    input.setAttribute('inputmode', 'numeric')
    input.setAttribute('autocomplete', 'tel')
    input.setAttribute('placeholder', '(11) 91234-5678')

    input.addEventListener('input', function () {
      const start = input.selectionStart || 0
      const before = input.value
      const formatted = formatBRPhone(before)
      input.value = formatted

      // tentativa simples de manter o cursor no fim em dispositivos móveis
      try {
        if (document.activeElement === input) {
          const delta = formatted.length - before.length
          const next = Math.max(0, Math.min(formatted.length, start + delta))
          input.setSelectionRange(next, next)
        }
      } catch (_) {}
    })

    // normaliza ao carregar (caso venha do banco já com/sem máscara)
    if (input.value) {
      input.value = formatBRPhone(input.value)
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const telById = document.getElementById('telefone')
    attachMask(telById)

    const telByName = document.querySelector('input[name=\"telefone\"]')
    if (telByName && telByName !== telById) attachMask(telByName)
  })
})()

