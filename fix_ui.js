const fs = require('fs');

// 1. Limpiar HTML: eliminar "kicker", corregir densidades.
let html = fs.readFileSync('frontend/index.html', 'utf8');

// Eliminar todos los kickers
html = html.replace(/<p\s+class="[^"]*kicker[^"]*"[^>]*>.*?<\/p>/gi, '');
html = html.replace(/<span\s+class="[^"]*kicker[^"]*"[^>]*>.*?<\/span>/gi, '');

// A veces no tienen clase "kicker" pero están antes de un h1/h2 con mayúsculas, 
// pero regex es seguro usarlo en clases nombradas. 
// Vamos a asegurarnos de que la palabra "kicker" se vaya en todas partes.
html = html.replace(/<[^>]+class="kicker"[^>]*>.*?<\/[^>]+>/gi, '');

fs.writeFileSync('frontend/index.html', html);


// 2. Limpiar CSS: Hacerlo corporativo y denso
let css = fs.readFileSync('frontend/css/styles.css', 'utf8');

// A) Reducir borderRadius a algo más corporativo (4px o 6px max)
css = css.replace(/border-radius:\s*[1-9][0-9]*px/g, 'border-radius: 4px');
css = css.replace(/border-radius:\s*2rem/g, 'border-radius: 0.25rem');

// B) Matar sombras de colores oscuros ("dark glows") - Reemplazar #00... por algo neutral o sin blur
css = css.replace(/box-shadow:\s*0\s+[0-9]+px\s+[0-9]+px\s+#[0-9a-fA-F]+/g, 'box-shadow: 0 1px 3px rgba(0,0,0,0.1)');
// También var(--shadow)
css = css.replace(/box-shadow:\s*var\(--shadow\)/g, 'box-shadow: 0 1px 2px rgba(0,0,0,0.05)');

// C) Aumentar densidad reduciendo padding masivo
css = css.replace(/padding:\s*120px/g, 'padding: 40px');
css = css.replace(/padding:\s*80px/g, 'padding: 30px');
css = css.replace(/padding:\s*60px/g, 'padding: 24px');
css = css.replace(/padding:\s*40px/g, 'padding: 16px');
css = css.replace(/padding:\s*30px/g, 'padding: 12px');
css = css.replace(/padding:\s*32px/g, 'padding: 12px');
css = css.replace(/padding:\s*24px/g, 'padding: 8px');

// Reducir márgenes enormes
css = css.replace(/margin-bottom:\s*80px/g, 'margin-bottom: 24px');
css = css.replace(/margin-bottom:\s*60px/g, 'margin-bottom: 20px');
css = css.replace(/margin-bottom:\s*40px/g, 'margin-bottom: 16px');
css = css.replace(/margin-bottom:\s*32px/g, 'margin-bottom: 12px');

// Reducir tamaños de fuente gigantes
css = css.replace(/font-size:\s*48px/g, 'font-size: 24px');
css = css.replace(/font-size:\s*40px/g, 'font-size: 20px');
css = css.replace(/font-size:\s*32px/g, 'font-size: 18px');
css = css.replace(/font-size:\s*28px/g, 'font-size: 16px');

// Fondo corporativo más sobrio (blanco / gris en lugar de oscuro si aplica)
css = css.replace(/background:\s*#112c42/g, 'background: #f4f6f8'); 
css = css.replace(/color:\s*#fff/g, 'color: #1a1a1a');
css = css.replace(/color:\s*white/g, 'color: #1a1a1a');

fs.writeFileSync('frontend/css/styles.css', css);

console.log("Limpieza ejecutada.");
