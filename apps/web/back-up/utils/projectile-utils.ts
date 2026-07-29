function getTileCenterById(tileId: string | number) {
    const el = document.querySelector<HTMLElement>(`.battle-grid-tile[data-tile-id="${tileId}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
}

export function throwWeapon(fromTileId: string | number, toTileId: string | number, durationMs = 500) {
    const from = getTileCenterById(fromTileId);
    const to = getTileCenterById(toTileId);
    if (!from || !to) return Promise.resolve();

    const el = document.createElement('div');
    const size = 50;

    Object.assign(el.style, {
        position: 'fixed',
        left: `${from.x - size / 2}px`,
        top: `${from.y - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        backgroundImage: `url("/images/hero-equipment/weapons/hammers/rare-type/molner/molner-hammer.png")`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        zIndex: '1000',
        pointerEvents: 'none',
        transform: 'translate(0, 0) rotate(0deg)',
        transition: `transform ${durationMs}ms cubic-bezier(.2,.9,.3,1), opacity 120ms ease-out`,
        willChange: 'transform',
        filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.4))'
    });

    document.body.appendChild(el);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    // 🎞️ Запускаємо анімацію на наступному кадрі
    requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(${angle + 720}deg)`;
    });

    return new Promise<void>((resolve) => {
        const cleanup = () => {
            el.removeEventListener('transitionend', onEnd);
            el.remove();
            resolve();
        };
        const onEnd = () => {
            el.style.opacity = '0';
            setTimeout(cleanup, 100);
        };
        el.addEventListener('transitionend', onEnd, {once: true});
        setTimeout(onEnd, durationMs + 80);
    });
}
