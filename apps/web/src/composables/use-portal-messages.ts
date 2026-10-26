import { i18n } from '@/i18n';

export function portalRefusalText(reason: string): string {
  switch (reason) {
    case 'HERO_NOT_FOUND':
      return i18n.global.t('portal.refusal.HERO_NOT_FOUND');
    case 'NO_LOCATION':
      return i18n.global.t('portal.refusal.NO_LOCATION');
    case 'IN_CAMPING':
      return i18n.global.t('portal.refusal.IN_CAMPING');
    case 'IN_COMBAT':
      return i18n.global.t('portal.refusal.IN_COMBAT');
    case 'PORTAL_ALREADY_OPEN':
      return i18n.global.t('portal.refusal.PORTAL_ALREADY_OPEN');
    case 'NOT_ADJACENT':
      return i18n.global.t('portal.refusal.NOT_ADJACENT');
    case 'NO_TILE':
      return i18n.global.t('portal.refusal.NO_TILE');
    case 'NOT_GROUND':
      return i18n.global.t('portal.refusal.NOT_GROUND');
    case 'TILE_OCCUPIED':
      return i18n.global.t('portal.refusal.TILE_OCCUPIED');
    case 'EXIT_HEX':
      return i18n.global.t('portal.refusal.EXIT_HEX');
    case 'NO_SCROLL':
      return i18n.global.t('portal.refusal.NO_SCROLL');
    case 'NOT_AN_ANGEL':
      return i18n.global.t('portal.refusal.NOT_AN_ANGEL');
    case 'INSUFFICIENT_WILL':
      return i18n.global.t('portal.refusal.INSUFFICIENT_WILL');
    case 'NO_WILL_STATE':
      return i18n.global.t('portal.refusal.NO_WILL_STATE');
    case 'NO_PORTAL':
      return i18n.global.t('portal.refusal.NO_PORTAL');
    case 'NOT_YOUR_PORTAL':
      return i18n.global.t('portal.refusal.NOT_YOUR_PORTAL');
    default:
      return i18n.global.t('portal.refusal.NO_LOCATION');
  }
}
