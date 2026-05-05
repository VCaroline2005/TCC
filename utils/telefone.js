export function stripNonDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

export function normalizeTelefoneBR(value) {
  const digits = stripNonDigits(value)
  if (!digits) return ''

  // Brasil:
  // - 10 dígitos: DDD (2) + fixo (8)
  // - 11 dígitos: DDD (2) + móvel (9)
  if (digits.length === 10 || digits.length === 11) return digits

  const error = new Error('Telefone inválido')
  error.code = 'telefone_invalido'
  throw error
}

export function formatTelefoneBR(value) {
  const digits = stripNonDigits(value)
  if (!digits) return ''
  if (digits.length < 10) return digits

  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (rest.length === 8) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  }

  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
  }

  return digits
}

