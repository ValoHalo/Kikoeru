import { t } from '../i18n'

export function appDialog ($q, options) {
  const button = (value, fallback) => value && typeof value === 'object' ? value : { label: typeof value === 'string' ? value : fallback }
  const ok = button(options.ok, t('common.ok'))
  return $q.dialog({
    ...options,
    cardClass: ['app-confirm-dialog', options.cardClass],
    ok: options.ok === false ? false : { ...ok, flat: false, unelevated: true, noCaps: true, color: ok.color || 'primary' },
    cancel: options.cancel === false || options.cancel == null ? false : { ...button(options.cancel, t('common.cancel')), flat: true, noCaps: true, color: undefined, class: 'app-dialog-cancel' }
  })
}
