const fs = require('fs');

// 1. Limpiar HTML: eliminar "eyebrow"
let html = fs.readFileSync('frontend/index.html', 'utf8');

// Eliminar todos los eyebrow
html = html.replace(/<[^>]+class="eyebrow"[^>]*>.*?<\/[^>]+>/gi, '');

// Aumentar sizes de <small> para no fallar el undersized-text (11px max)
// O mejor en CSS:
// documentar que los undersized van a ser fijados en CSS
fs.writeFileSync('frontend/index.html', html);

// 2. CSS fix para el tamaño de texto funcional debajo de 11px
let css = fs.readFileSync('frontend/css/styles.css', 'utf8');
css = css.replace(/font-size:\s*8px/g, 'font-size: 11px');
css = css.replace(/font-size:\s*9px/g, 'font-size: 11px');
css = css.replace(/font-size:\s*10px/g, 'font-size: 11px');
css = css.replace(/font-size:\s*0\.5rem/g, 'font-size: 0.7rem');
css = css.replace(/font-size:\s*0\.6rem/g, 'font-size: 0.75rem');

fs.writeFileSync('frontend/css/styles.css', css);

console.log("Limpieza secundaria ejecutada.");
