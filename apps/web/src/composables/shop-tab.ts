import { ref } from 'vue';

export type ShopTabKey = 'goods' | 'buyback' | 'trade';

export const shopTab = ref<ShopTabKey>('goods');
