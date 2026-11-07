// Builds the FreshMart launcher icon for Android from icon-fg.svg
const sharp = require('sharp');
const fs = require('fs');
const res = 'android/app/src/main/res';
const fg = fs.readFileSync('icon-fg.svg');
const bg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0.3" y1="0" x2="0.7" y2="1"><stop offset="0" stop-color="#eaf87c"/><stop offset="1" stop-color="#8fd94a"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/></svg>');
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const mask = (s, round) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${round ? s / 2 : Math.round(s * 0.22)}" fill="#fff"/></svg>`);
(async () => {
  for (const [d, px] of Object.entries(dens)) {
    const dir = `${res}/mipmap-${d}`;
    fs.mkdirSync(dir, { recursive: true });
    const base = await sharp(bg).resize(px, px).composite([{ input: await sharp(fg).resize(px, px).png().toBuffer() }]).png().toBuffer();
    for (const [name, round] of [['ic_launcher', false], ['ic_launcher_round', true]]) {
      await sharp(base).composite([{ input: mask(px, round), blend: 'dest-in' }]).png().toFile(`${dir}/${name}.png`);
    }
    const a = Math.round(px * 2.25);
    await sharp(fg).resize(a, a).png().toFile(`${dir}/fm_fg.png`);
    await sharp(bg).resize(a, a).png().toFile(`${dir}/fm_bg.png`);
  }
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@mipmap/fm_bg"/>\n  <foreground android:drawable="@mipmap/fm_fg"/>\n</adaptive-icon>\n';
  fs.mkdirSync(`${res}/mipmap-anydpi-v26`, { recursive: true });
  fs.writeFileSync(`${res}/mipmap-anydpi-v26/ic_launcher.xml`, xml);
  fs.writeFileSync(`${res}/mipmap-anydpi-v26/ic_launcher_round.xml`, xml);
  console.log('FreshMart icons created');
})().catch(e => { console.error(e); process.exit(1); });
