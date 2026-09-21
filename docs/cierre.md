# Informe de cierre — DonativoSeguro

Fecha: 21 de septiembre de 2026. Alcance: convertir el frontend existente en una aplicación con persistencia, autenticación real y separación entre donadores y administración.

## Planificado y ejecutado

| Requisito | Resultado comprobado |
|---|---|
| Módulo de registro de donantes | CRUD administrativo, ficha personal automática para el donador, historial conservado al retirar un donante externo |
| JWT y roles administrador/usuario | Implementados. Sesiones revocables, rol consultado en SQL, contraseñas con scrypt |
| Base de datos | SQLite en el backend con cuatro tablas relacionadas, restricciones, transacciones e importes en centavos |
| Acceso privado | Cada donador ve únicamente sus aportaciones; consultar directamente otro folio devuelve 404; directorio y usuarios devuelven 403 |
| Quitar accesos de ejemplo | Eliminados del producto. Alta inicial con código privado y alta posterior desde administración |
| Mejorar UX | Login sin muestras; portal personal independiente, estados vacíos, filtros, montos sugeridos, confirmación y perfil; diseño administrativo conservado |
| Jest con cobertura mínima de 80 % | 34 pruebas aprobadas en cinco suites. Umbral configurado en las cuatro métricas globales del backend |
| CI/CD | Workflow de GitHub Actions preparado. Construcción y despliegue temporal de la imagen, prueba funcional y ZAP. Contenedor y prueba de staging ejecutados localmente |
| OWASP ZAP | Dos análisis Baseline locales ejecutados. Se corrigieron cabeceras y formularios; observaciones restantes descritas abajo |
| SonarQube | Dos análisis locales ejecutados. Métricas y deuda técnica exportadas; el quality gate final conserva observaciones pendientes |
| Alojamiento permanente | Pendiente de elegir proveedor/servidor, HTTPS, secretos y almacenamiento persistente. La instancia de CI es temporal |

El enunciado asigna 4 horas a implementación, 3 a calidad y 2 al cierre. No se midieron tiempos reales por actividad: no se presentan esas estimaciones como horas ejecutadas ni se inventan retrasos. La ampliación real de alcance fue pasar de un prototipo local a persistencia y permisos aplicados en el servidor. Solo se encontró la rama `main` local y remota; las carpetas de backend existentes eran el punto de partida.

## Evidencias de pruebas

| Métrica Jest | Resultado |
|---|---:|
| Pruebas / suites aprobadas | 34 / 5 |
| Sentencias | 98,52 % |
| Ramas | 93,51 % |
| Funciones | 100 % |
| Líneas | 98,90 % |

El denominador es `backend/src/**/*.js`, excepto el arranque `server.js`, probado al levantar el servidor y el contenedor. No se afirma cobertura unitaria del frontend. [Resultado exportado](evidencias/jest-cobertura.json).

Casos comprobados: alta inicial única, código incorrecto, contraseñas inválidas, JWT vencido o con firma/emisor/audiencia incorrectos, cierre de sesión, inactivación y revocación, intentos de cambiar el rol desde el perfil, acceso entre cuentas, CRUD, validación de cantidades/fechas, verificación, transacciones y persistencia tras reabrir la base. Las entradas con sintaxis SQL se conservan como valores y no se ejecutan.

La prueba de Chrome recorrió la instalación, creación de dos cuentas, efectivo y especie, confirmación, perfil, navegación, recarga de sesión y verificación. Se comprobó que una descripción con una etiqueta y `onerror` se muestra como texto, sin insertar imágenes ni ejecutar código. Se revisaron vistas de 1440 y 390 píxeles, sin desbordamiento horizontal. Tras convertir el script a módulo se repitieron restauración de sesión, cambio de cuenta y vista móvil.

La imagen Docker se construyó con las dependencias de producción y usuario sin privilegios. `backend/scripts/smoke.cjs` aprobó el recorrido de instalación, dos usuarios aislados, aportación, verificación y revocación en una base desechable. `npm audit --audit-level=high` informó **0 vulnerabilidades conocidas** en la consulta realizada. Esto no equivale a una garantía de ausencia de vulnerabilidades.

## Seguridad: ZAP

Herramienta: imagen oficial `ghcr.io/zaproxy/zaproxy:stable`, escaneo **Baseline pasivo sin autenticar** contra la instancia de pruebas en el puerto 3100. No se utilizó la base de uso normal. El análisis final recorrió 9 URL, con 63 reglas PASS, 4 grupos WARN y 0 FAIL según la clasificación del script. [Resumen de alertas](evidencias/zap-resumen.json).

Correcciones aplicadas después del primer análisis:

- Se restringió `font-src` a recursos del mismo origen.
- Se añadió `Permissions-Policy` y se activó `Cross-Origin-Embedder-Policy`.
- Los formularios de acceso y de escritura especifican POST, evitando que un envío nativo ponga contraseñas en la URL. El frontend envía sus operaciones mediante JSON a la API.

La alerta media **Absence of Anti-CSRF Tokens**, de confianza baja, se conserva en el reporte. El analizador detecta formularios HTML sin un token CSRF. Esta aplicación no autentica mediante cookies: las peticiones privadas requieren un Bearer JWT agregado por JavaScript y la API rechaza orígenes distintos al configurado. Por ello no existe la autenticación automática por cookies que presupone esa alerta; si se migra a cookies, será necesario añadir protección CSRF explícita. No se desactivó la regla para ocultar el hallazgo.

Las otras alertas son informativas: aplicación moderna, detección de un formulario de autenticación y contenido cacheable o almacenable. Las respuestas de la API llevan `Cache-Control: no-store`; los archivos públicos de la interfaz pueden almacenarse en caché. El parámetro `-I` permite completar CI con avisos, cuyos artefactos quedan disponibles para revisión.

Este Baseline **no ejecuta un pentest autenticado ni demuestra por sí solo ausencia de SQLi o XSS**. Las pruebas de entradas y propiedad descritas anteriormente son evidencia complementaria. El siguiente ciclo debe añadir un escaneo activo autenticado en una base desechable y pruebas de concurrencia/carga antes de exponer el servicio públicamente. [Alcance oficial de Baseline](https://www.zaproxy.org/docs/docker/baseline-scan/).

## Calidad: SonarQube

Se ejecutó SonarQube Community 9.9.8 con Scanner CLI 8.1.0 y configuración `sonar-project.properties`. Los archivos analizados incluyen backend y frontend; se importa LCOV del backend. El analizador de esta edición avisó sobre la versión de Node incluida en el scanner, pero completó el análisis. También falta información de autoría de Git para los cambios todavía no confirmados.

| Métrica final | Valor |
|---|---:|
| Bugs | 0 |
| Vulnerabilidades identificadas | 0 |
| Code smells | 26 |
| Deuda técnica estimada por Sonar | 236 minutos (3 h 56 min) |
| Cobertura agregada calculada por Sonar | 96,6 % |
| Duplicación de líneas | 0,0 % |
| Hotspots identificados | 1 |

[Métricas exportadas](evidencias/sonar-metricas.json). La estimación de deuda pertenece a Sonar; no es una medición del tiempo que tomará corregirla. Su cobertura agrega líneas y condiciones, por lo que difiere del porcentaje de líneas de Jest.

Se revisó el hotspot de la línea que asigna `input.type = 'password'`: representa el tipo de campo HTML y **no una contraseña incrustada**. Se registró como revisado y seguro en SonarQube, con la explicación correspondiente.

El **quality gate final no está aprobado**: respecto a la primera instantánea local, la mantenibilidad del código nuevo es B y su cobertura de código nuevo es 66,7 %. Esto es distinto del 98,90 % de líneas globales de Jest. No se redujeron los umbrales ni se excluyeron hallazgos para obtener un resultado verde. [Estado del gate](evidencias/sonar-gate.json).

Las mejoras pendientes se concentran en complejidad de renderizadores y gestión de errores, plantillas HTML anidadas y selectores CSS duplicados. El primer análisis tenía 29 smells y una deuda estimada de 720 minutos; se añadieron etiquetas accesibles, se retiró una llamada obsoleta y el script pasó a un módulo, reduciendo esos valores a 26 y 236 respectivamente.

## Lecciones y siguiente ciclo

1. Ocultar botones no protege información: los permisos y la propiedad deben comprobarse en cada consulta del backend.
2. Una ficha de donante y una cuenta de acceso son conceptos diferentes. Se vinculan explícitamente, evitando que el donador seleccione o suplante otra identidad.
3. Los datos de demostración deben mantenerse fuera de la instalación normal. La separación de bases permitió probar altas, bajas y ataques sin contaminar los registros del usuario.
4. La cobertura global y la cobertura del código nuevo responden a preguntas distintas. Ambas deben revisarse junto con el comportamiento, no usarse como única prueba de calidad.

Prioridades propuestas:

| Prioridad | Mejora | Criterio de aceptación |
|---|---|---|
| Alta | Reducir complejidad y cubrir ramas nuevas | Quality gate aprobado sin bajar umbrales |
| Alta | Elegir alojamiento de una sola instancia, HTTPS y respaldo | Restauración de un respaldo verificada y volumen persistente |
| Alta | Escaneo activo autenticado y controles de carga | Reporte revisado, sin hallazgos altos abiertos, ejecutado sobre datos desechables |
| Media | Invitaciones de un solo uso y cambio de contraseña propio | El administrador no necesita comunicar una contraseña permanente |
| Media | Auditoría completa de cambios | Registrar actor, fecha y cambio para operaciones administrativas |
| Media | Migraciones versionadas y PostgreSQL si crece la concurrencia | Actualizaciones reproducibles y pruebas de migración |

No se implementaron cobros reales, correo transaccional, recuperación automática por correo ni predicción de donaciones. Esas funciones requieren alcance y servicios adicionales; las métricas del portal reflejan registros existentes, no impacto social estimado.
