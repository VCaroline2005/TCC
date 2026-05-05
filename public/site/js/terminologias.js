(function () {
  function byId(id) {
    return document.getElementById(id)
  }

  // Accordion
  document.querySelectorAll('[data-term-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const target = btn.getAttribute('data-term-toggle')
      const el = target ? byId(target) : null
      if (!el) return
      const isOpen = el.classList.toggle('is-open')
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
    })
  })

  // Alphabet filter (client side)
  const alpha = document.getElementById('termAlpha')
  if (alpha) {
    alpha.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest ? e.target.closest('[data-letter]') : null
      if (!btn) return
      const letter = btn.getAttribute('data-letter') || ''
      document.querySelectorAll('.alpha-btn').forEach(function (b) {
        b.classList.toggle('is-on', b === btn)
      })

      const groups = document.querySelectorAll('[data-letter-group]')
      groups.forEach(function (g) {
        const gLetter = g.getAttribute('data-letter-group') || ''
        const show = !letter || gLetter === letter
        g.style.display = show ? '' : 'none'
      })

      const quick = document.querySelectorAll('.quick a[data-letter]')
      quick.forEach(function (a) {
        a.classList.toggle('is-on', a.getAttribute('data-letter') === letter)
      })

      if (letter) {
        const anchor = document.getElementById('letter-' + letter)
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  // Quick nav click
  document.querySelectorAll('.quick a[data-letter]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault()
      const letter = a.getAttribute('data-letter') || ''
      const btn = document.querySelector('.alpha-btn[data-letter="' + letter + '"]')
      if (btn) btn.click()
    })
  })
})()
