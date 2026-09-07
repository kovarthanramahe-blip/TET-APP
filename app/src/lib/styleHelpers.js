export function navBtn(active) {
  return {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
    width: '100%', textAlign: 'left', cursor: 'pointer',
    fontFamily: 'var(--font-heading)', fontSize: '15px', letterSpacing: '.01em',
    padding: '7px 10px', borderRadius: 'var(--radius-md)',
    color: active ? 'var(--accent-ink)' : 'var(--color-text)',
    background: active ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
    border: '1px solid ' + (active ? 'var(--color-accent)' : 'transparent')
  };
}

export function chip(active, small) {
  return {
    cursor: 'pointer', fontFamily: 'var(--font-heading)',
    fontSize: small ? '12px' : '13px', padding: small ? '4px 8px' : '5px 11px',
    borderRadius: 'var(--radius-md)',
    background: active ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent',
    color: active ? 'var(--accent-ink)' : 'var(--color-text)',
    border: '1px solid ' + (active ? 'var(--color-accent)' : 'var(--color-divider)')
  };
}

export function checkbox(done) {
  return {
    width: '22px', height: '22px', flex: 'none', cursor: 'pointer',
    borderRadius: 'var(--radius-sm)', background: 'transparent',
    border: '1px solid ' + (done ? 'var(--color-accent)' : 'var(--color-divider)'),
    color: 'var(--color-accent)', fontSize: '13px', lineHeight: 1, padding: 0
  };
}
