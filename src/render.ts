import { HorizontalLayout, VerticalLayout } from './layouts';

// Convert #rgba and #rrggbbaa to rgba(). This is required for older
// browsers that doesn't accept this syntax.
const _c = (s: string) => {
    if (s.match(/^#[0-9a-fA-F]{4}$/)) {
        const r = parseInt(s[1], 16) * 17;
        const g = parseInt(s[2], 16) * 17;
        const b = parseInt(s[3], 16) * 17;
        const a = parseInt(s[4], 16) / 15;
        return `rgba(${r},${g},${b},${a.toFixed(3)})`;
    }
    if (s.match(/^#[0-9a-fA-F]{8}$/)) {
        const r = parseInt(s.slice(1, 3), 16);
        const g = parseInt(s.slice(3, 5), 16);
        const b = parseInt(s.slice(5, 7), 16);
        const a = parseInt(s.slice(7, 9), 16) / 255;
        return `rgba(${r},${g},${b},${a.toFixed(3)})`;
    }
    return s;
};

export const STYLES = 8;

export const drawBead = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    style: number,
    honrizontalLayout: HorizontalLayout,
    verticalLayout: VerticalLayout,
) => {
    if (style !== Math.floor(style) || style < 0 || style >= STYLES) {
        throw Error('Invalid bead style');
    }
    const w = honrizontalLayout.beadWidth / 2;
    const h = verticalLayout.beadHeight / 2;
    const t = honrizontalLayout.beadHole / 2;
    const b = verticalLayout.beadExtra / 2;
    const gradient = ctx.createLinearGradient(0, h, 0, -h);
    let dark = false;
    let raw = false;
    if (style === 0) {
        // Raw Wood
        raw = true;
        gradient.addColorStop(0, _c('#382510'));
        gradient.addColorStop(0.05, _c('#543a24'));
        gradient.addColorStop(0.45, _c('#805529'));
        gradient.addColorStop(0.5, _c('#805c33'));
        gradient.addColorStop(0.55, _c('#9a7245'));
        gradient.addColorStop(0.9, _c('#a37232'));
        gradient.addColorStop(0.95, _c('#92642a'));
        gradient.addColorStop(1, _c('#744810'));
    } else if (style === 1) {
        // Varnished Wood
        gradient.addColorStop(0, _c('#220c00'));
        gradient.addColorStop(0.05, _c('#541a02'));
        gradient.addColorStop(0.45, _c('#a02f0c'));
        gradient.addColorStop(0.5, _c('#ac4633'));
        gradient.addColorStop(0.55, _c('#ba3c0c'));
        gradient.addColorStop(0.9, _c('#983828'));
        gradient.addColorStop(0.95, _c('#9c3212'));
        gradient.addColorStop(1, _c('#742800'));
    } else if (style === 2) {
        // Ivory
        gradient.addColorStop(0, _c('#333333'));
        gradient.addColorStop(0.05, _c('#544322'));
        gradient.addColorStop(0.45, _c('#a07f5c'));
        gradient.addColorStop(0.5, _c('#bca683'));
        gradient.addColorStop(0.55, _c('#ba9c7c'));
        gradient.addColorStop(0.9, _c('#987858'));
        gradient.addColorStop(0.95, _c('#907252'));
        gradient.addColorStop(1, _c('#564432'));
    } else if (style === 3) {
        // Orange
        gradient.addColorStop(0, _c('#773100'));
        gradient.addColorStop(0.05, _c('#882c00'));
        gradient.addColorStop(0.15, _c('#883300'));
        gradient.addColorStop(0.45, _c('#aa5500'));
        gradient.addColorStop(0.49, _c('#cc7b2c'));
        gradient.addColorStop(0.51, _c('#cc7b2c'));
        gradient.addColorStop(0.55, _c('#cc7711'));
        gradient.addColorStop(0.85, _c('#dd8811'));
        gradient.addColorStop(0.95, _c('#ee9933'));
        gradient.addColorStop(1, _c('#552c10'));
    } else if (style === 4) {
        // White
        gradient.addColorStop(0, _c('#333333'));
        gradient.addColorStop(0.05, _c('#4c4c4c'));
        gradient.addColorStop(0.45, _c('#999999'));
        gradient.addColorStop(0.5, _c('#b4b4b4'));
        gradient.addColorStop(0.55, _c('#afafaf'));
        gradient.addColorStop(0.95, _c('#9c9c9c'));
        gradient.addColorStop(1, _c('#333333'));
    } else if (style === 5) {
        // Red
        dark = true;
        gradient.addColorStop(0, _c('#221008cc'));
        gradient.addColorStop(0.05, _c('#320700'));
        gradient.addColorStop(0.45, _c('#641804'));
        gradient.addColorStop(0.5, _c('#772222'));
        gradient.addColorStop(0.55, _c('#872c2c'));
        gradient.addColorStop(0.95, _c('#751c0c'));
        gradient.addColorStop(1, _c('#400000cc'));
    } else if (style === 6) {
        // Black
        dark = true;
        gradient.addColorStop(0, _c('#111111cc'));
        gradient.addColorStop(0.05, _c('#202020'));
        gradient.addColorStop(0.45, _c('#3c3c3c'));
        gradient.addColorStop(0.5, _c('#4c4c4c'));
        gradient.addColorStop(0.55, _c('#555555'));
        gradient.addColorStop(0.95, _c('#333333'));
        gradient.addColorStop(1, _c('#222222cc'));
    } else if (style === 7) {
        // Green
        gradient.addColorStop(0, _c('#25361c'));
        gradient.addColorStop(0.05, _c('#303829'));
        gradient.addColorStop(0.45, _c('#6a7c5a'));
        gradient.addColorStop(0.5, _c('#8c9c80'));
        gradient.addColorStop(0.55, _c('#8a9c68'));
        gradient.addColorStop(0.9, _c('#8ca070'));
        gradient.addColorStop(0.95, _c('#84927a'));
        gradient.addColorStop(1, _c('#487410'));
    }
    // TODO: maybe use another blending mode?
    const lightGradient = ctx.createRadialGradient(
        0,
        -h / 6e3,
        0,
        0,
        -h / 6e3,
        w * 1.04,
    );
    if (!dark) {
        lightGradient.addColorStop(0, _c('#ffffff1a'));
        lightGradient.addColorStop(0.4, _c('#ffffff00'));
        lightGradient.addColorStop(0.42, _c('#00000000'));
        lightGradient.addColorStop(0.9, _c('#00000044'));
        lightGradient.addColorStop(0.98, _c('#000000aa'));
        lightGradient.addColorStop(1, _c('#000000ff'));
    } else {
        lightGradient.addColorStop(0, _c('#ffffff10'));
        lightGradient.addColorStop(0.4, _c('#ffffff00'));
        lightGradient.addColorStop(0.42, _c('#00000000'));
        lightGradient.addColorStop(0.9, _c('#00000033'));
        lightGradient.addColorStop(0.98, _c('#00000088'));
        lightGradient.addColorStop(1, _c('#000000ff'));
    }
    const sparkGradient = ctx.createLinearGradient(0, -h * 0.1, h, -h);
    if (!dark && !raw) {
        sparkGradient.addColorStop(0.3, _c('#ffffff00'));
        sparkGradient.addColorStop(0.4, _c('#ffffff0c'));
        sparkGradient.addColorStop(0.5, _c('#ffffff22'));
        sparkGradient.addColorStop(0.6, _c('#ffffff0c'));
        sparkGradient.addColorStop(0.7, _c('#ffffff00'));
    } else {
        sparkGradient.addColorStop(0.1, _c('#ffffff00'));
        sparkGradient.addColorStop(0.35, _c('#ffffff0f'));
        sparkGradient.addColorStop(0.5, _c('#ffffff1f'));
        sparkGradient.addColorStop(0.65, _c('#ffffff08'));
        sparkGradient.addColorStop(0.7, _c('#ffffff00'));
    }
    const shadowGradient = ctx.createLinearGradient(0, h * 0.1, -h, h);
    if (!dark && !raw) {
        shadowGradient.addColorStop(0.3, _c('#ffffff00'));
        shadowGradient.addColorStop(0.35, _c('#ffffff04'));
        shadowGradient.addColorStop(0.5, _c('#ffffff1c'));
        shadowGradient.addColorStop(0.65, _c('#ffffff10'));
        shadowGradient.addColorStop(0.7, _c('#ffffff00'));
    } else {
        shadowGradient.addColorStop(0.1, _c('#ffffff00'));
        shadowGradient.addColorStop(0.35, _c('#ffffff08'));
        shadowGradient.addColorStop(0.5, _c('#ffffff10'));
        shadowGradient.addColorStop(0.65, _c('#ffffff04'));
        shadowGradient.addColorStop(0.7, _c('#ffffff00'));
    }
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(w, -b);
    ctx.lineTo(w, b);
    ctx.lineTo(t, h);
    ctx.lineTo(-t, h);
    ctx.lineTo(-w, b);
    ctx.lineTo(-w, -b);
    ctx.lineTo(-t, -h);
    ctx.lineTo(t, -h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = lightGradient;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w, -b);
    ctx.lineTo(t, -h);
    ctx.lineTo(-t, -h);
    ctx.lineTo(-w, -b);
    ctx.lineTo(-w, 0);
    ctx.closePath();
    ctx.fillStyle = sparkGradient;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w, b);
    ctx.lineTo(t, h);
    ctx.lineTo(-t, h);
    ctx.lineTo(-w, b);
    ctx.lineTo(-w, 0);
    ctx.closePath();
    ctx.fillStyle = shadowGradient;
    ctx.fill();
    ctx.restore();
};

export const drawRod = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    x2: number,
    y1: number,
    y2: number,
) => {
    const gradient = ctx.createLinearGradient(x1, 0, x2, 0);
    gradient.addColorStop(0, _c('#181008'));
    gradient.addColorStop(0.1, _c('#513c21'));
    gradient.addColorStop(0.4, _c('#705533'));
    gradient.addColorStop(0.5, _c('#82725c'));
    gradient.addColorStop(0.6, _c('#82725c'));
    gradient.addColorStop(0.75, _c('#775533'));
    gradient.addColorStop(0.9, _c('#554422'));
    gradient.addColorStop(1, _c('#160702'));
    ctx.fillStyle = gradient;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
};

export const drawBeam = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    x2: number,
    y1: number,
    y2: number,
) => {
    const gradient = ctx.createLinearGradient(0, y1, 0, y2);
    gradient.addColorStop(0, _c('#00000088'));
    gradient.addColorStop(0.1, _c('#000000'));
    gradient.addColorStop(0.2, _c('#bbbbbb'));
    gradient.addColorStop(0.3, _c('#888888'));
    gradient.addColorStop(0.6, _c('#888888'));
    gradient.addColorStop(0.8, _c('#727272'));
    gradient.addColorStop(0.9, _c('#000000'));
    gradient.addColorStop(1, _c('#00000088'));
    ctx.fillStyle = gradient;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
};

export const drawBeamDot = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
) => {
    ctx.fillStyle = '#181818';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
};
