(function () {
  const pageSize = 8

  function qs(id) {
    return document.getElementById(id)
  }

  const tbody = qs('medTbody')
  if (!tbody) return

  const rows = Array.from(tbody.querySelectorAll('.med-row'))
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const rangeEl = qs('medRange')
  const pagerEl = qs('medPager')

  function closeAllDetails() {
    tbody.querySelectorAll('.details-row.is-open').forEach(function (tr) {
      tr.classList.remove('is-open')
    })
  }

  function setVisibleRow(idx, visible) {
    const row = rows[idx]
    if (row) row.style.display = visible ? '' : 'none'
    const details = qs('med-details-' + idx)
    if (details) details.style.display = visible && details.classList.contains('is-open') ? '' : 'none'
    if (details && !visible) details.style.display = 'none'
  }

  function renderRange(page) {
    if (!rangeEl) return
    const start = (page - 1) * pageSize + 1
    const end = Math.min(page * pageSize, total)
    rangeEl.textContent = `Mostrando ${start} a ${end} de ${total} medicamentos`
  }

  function renderPager(page) {
    if (!pagerEl) return
    pagerEl.innerHTML = ''

    function addBtn(label, onClick, opts) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'pagebtn' + (opts && opts.active ? ' is-on' : '')
      btn.textContent = label
      if (opts && opts.disabled) {
        btn.disabled = true
        btn.style.opacity = '0.55'
        btn.style.cursor = 'default'
      } else {
        btn.addEventListener('click', onClick)
      }
      pagerEl.appendChild(btn)
    }

    addBtn('‹', function () { goTo(page - 1) }, { disabled: page <= 1 })

    const maxButtons = 7
    let start = Math.max(1, page - Math.floor(maxButtons / 2))
    let end = Math.min(totalPages, start + maxButtons - 1)
    start = Math.max(1, end - maxButtons + 1)

    for (let p = start; p <= end; p++) {
      addBtn(String(p), function () { goTo(p) }, { active: p === page })
    }

    addBtn('›', function () { goTo(page + 1) }, { disabled: page >= totalPages })
  }

  function goTo(page) {
    const safe = Math.min(totalPages, Math.max(1, page))
    closeAllDetails()
    for (let i = 0; i < total; i++) setVisibleRow(i, false)
    const startIdx = (safe - 1) * pageSize
    const endIdx = Math.min(total, safe * pageSize)
    for (let i = startIdx; i < endIdx; i++) setVisibleRow(i, true)
    renderRange(safe)
    renderPager(safe)
  }

  // Toggle details
  document.addEventListener('click', function (e) {
    const btn = e.target && e.target.closest ? e.target.closest('[data-med-toggle]') : null
    if (!btn) return
    const idx = btn.getAttribute('data-med-toggle')
    const details = qs('med-details-' + idx)
    if (!details) return
    const isOpen = details.classList.toggle('is-open')
    details.style.display = isOpen ? '' : 'none'
  })

  goTo(1)
})()

