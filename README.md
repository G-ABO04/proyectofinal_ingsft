# DonativoSeguro

Aplicación de registro y seguimiento de aportaciones. El frontend usa HTML, CSS y JavaScript; Express sirve la interfaz y una API con JWT. Los registros se guardan en una **base de datos SQLite real**, en el servidor. No existen cuentas de ejemplo ni un registro público de administradores.

## Arranque en Windows

Requiere Node.js 24.11 o posterior de la rama 24 y npm. Desde la carpeta del proyecto:

```powershell
cd backend
npm ci
npm run configure
npm start
```

Abre **http://127.0.0.1:3000**. Para esta versión se utiliza el servidor del backend, en lugar de Live Server o abrir `index.html` directamente.

1. En la primera visita aparece **Configura tu organización**.
2. Abre `backend/.env` en tu editor y copia únicamente el valor de `SETUP_TOKEN` al campo Código de instalación. No compartas el archivo ni subas sus valores a Git.
3. Elige tu nombre, correo y una contraseña de al menos 12 caracteres. Se crea el primer administrador y se cierra permanentemente el alta inicial mientras existan cuentas.
4. Inicia sesión. En **Usuarios → Nuevo usuario**, crea una cuenta con rol **Usuario** para cada donador. Proporciona sus credenciales de forma privada.
5. La cuenta nueva entra en su portal personal. El administrador puede verificar sus aportaciones, cambiar sus datos o contraseña y desactivar su acceso.

`npm run configure` genera secretos aleatorios y no sobrescribe un `.env` ya configurado. En esta computadora ya se ejecutó. La base de uso normal comienza vacía; los datos utilizados para pruebas están en archivos distintos y excluidos de Git.

## Qué puede hacer cada cuenta

| Operación | Donador / Usuario | Administrador |
|---|---|---|
| Registrar una aportación | A su propio nombre | Para un donante del directorio |
| Consultar donativos | Únicamente los de su cuenta | Todos |
| Consultar o editar el directorio | Sin acceso | Sí |
| Verificar aportaciones | Sin acceso | Sí, con responsable y fecha |
| Editar perfil | Nombre y teléfono propios | Gestión de cuentas |
| Crear, activar y desactivar cuentas | Sin acceso | Sí |

El servidor aplica estas reglas aunque se cambie la URL o se llame a la API manualmente. No se envían al donador los nombres, identificadores de responsables o aportaciones de otras cuentas. Los donantes externos sin una cuenta se registran desde administración; su historial se conserva al retirarlos del directorio. El vínculo entre una cuenta y su ficha personal no puede transferirse a otra cuenta.

El portal personal tiene Inicio, Hacer un donativo, Mis donativos, Mi impacto y Perfil. Los importes representan **aportaciones registradas**; la aplicación no cobra, transfiere dinero ni emite comprobantes fiscales. La verificación administrativa confirma la revisión del registro. La meta de impacto es orientativa y no representa beneficiarios atendidos.

## Base de datos y estructura

```text
backend/
  src/
    app.js                 Express, cabeceras y rutas
    server.js              Arranque y cierre del servidor
    config.js              Variables de entorno
    database.js            Esquema SQL y transacciones
    security.js            Hash de contraseñas y secretos
    validation.js          Validaciones de entrada
    data/                  Consultas y representación pública de datos
    middleware/            Autenticación y autorización
    routes/                Auth, usuarios, donantes y donativos
  tests/                   Jest y Supertest
  scripts/                 Configuración, pruebas de navegador y staging
  storage/                 Archivos privados, excluidos de Git
frontend/
  index.html
  css/styles.css
  js/scrip.js              Módulo JavaScript del navegador
.github/workflows/quality.yml
Dockerfile
sonar-project.properties
docs/                      Evidencias y cierre
```

Archivo normal: `backend/storage/donativoseguro.sqlite`. SQLite conserva los datos tras cerrar el navegador o reiniciar el servidor. Sus archivos `-wal` y `-shm` son normales mientras la base está abierta.

| Tabla | Contenido y relaciones |
|---|---|
| `users` | Cuenta, correo único, hash con sal, rol, estado y perfil |
| `donors` | Ficha del donante, propietario y vínculo opcional único con `users` |
| `donations` | Donante, propietario, autor del registro, tipo, importe en centavos, estado y verificador |
| `sessions` | Identificador de sesión JWT, usuario y vencimiento |

Las claves foráneas mantienen las relaciones y las transacciones evitan cambios incompletos. Las consultas reciben parámetros, sin concatenar entradas del usuario en SQL. Para respaldar esta instalación local, detén el servidor con Ctrl+C y copia la carpeta `backend/storage` a un destino privado. Conserva los archivos juntos. No reemplaces una base en uso. SQLite es apropiado para esta instalación de una sola instancia; múltiples réplicas requerirían migrar a una base de datos compartida, por ejemplo PostgreSQL, y diseñar migraciones.

## Seguridad y API

- Contraseñas con `scrypt`, sal aleatoria y comparación segura. La API nunca devuelve contraseñas ni hashes.
- JWT HS256 con emisor, audiencia, vencimiento de 30 minutos y sesión registrada en SQL. El rol y el estado se consultan en la base en cada petición.
- Cerrar sesión revoca ese token. Cambiar contraseña o rol y desactivar una cuenta revoca sus sesiones. No hay renovación automática; al vencer hay que iniciar sesión nuevamente.
- El token está en `sessionStorage`, separado por pestaña. Sigue siendo accesible a JavaScript: la política CSP y el escape de contenido reducen el riesgo de XSS, pero no sustituyen una revisión de seguridad.
- Validación estricta de campos, límites de tamaño e intentos de autenticación, origen permitido, cabeceras Helmet y respuestas sin detalles internos.
- `.env`, bases, respaldos y resultados de pruebas están excluidos de Git y de la imagen Docker. El `.env` vacío que estaba versionado se retiró del índice de Git.

Rutas principales, todas bajo `/api`:

| Ruta | Método | Acceso |
|---|---|---|
| `/health`, `/auth/status` | GET | Público, estado mínimo |
| `/auth/setup` | POST | Código de instalación y base sin cuentas |
| `/auth/login` | POST | Credenciales |
| `/auth/me`, `/auth/logout`, `/auth/profile` | GET, POST, PUT respectivamente | Cuenta activa |
| `/usuarios` | GET, POST | Administrador |
| `/usuarios/:id`, `/usuarios/:id/estado` | PUT, PATCH | Administrador |
| `/donantes`, `/donantes/:id` | GET, POST / GET, PUT, DELETE | Administrador |
| `/donativos`, `/donativos/:id` | GET, POST / GET | Cuenta activa y propiedad del registro |
| `/donativos/:id/verificar` | PATCH | Administrador |

No puedes quitarte tu propio rol de administrador ni desactivar tu cuenta desde la sesión actual. Si cambias tu propia contraseña, vuelve a iniciar sesión. La recuperación se gestiona con otro administrador; no hay envío automático de correos.

## Pruebas y entrega

```powershell
cd backend
npm run check
npm run test:coverage
npm audit --audit-level=high
```

Jest exige un mínimo de 80 % global en líneas, sentencias, funciones y ramas del backend. `src/server.js` se comprueba arrancando la aplicación; no se incluye en el denominador de las pruebas unitarias. La cobertura de la interfaz no se presenta como cobertura de Jest. Las evidencias y limitaciones se describen en [docs/cierre.md](docs/cierre.md).

GitHub Actions instala dependencias, ejecuta las pruebas, construye la imagen, **despliega una instancia temporal de prueba**, comprueba el recorrido con dos usuarios, ejecuta ZAP y guarda artefactos. La instancia termina al cerrar el job. El workflow se ejecutará al subir los cambios a `main`, abrir un PR o iniciarlo manualmente; no se ha enviado ningún cambio al remoto durante esta implementación.

Para SonarQube en Actions, configura la variable de repositorio `SONAR_HOST_URL` y el secreto `SONAR_TOKEN` de un servidor accesible por el runner. El análisis local ya se ejecutó y su configuración está en `sonar-project.properties`. No se incluyen credenciales de Sonar en el repositorio.

## Despliegue persistente

El contenedor usa un usuario sin privilegios y necesita `JWT_SECRET`, `SETUP_TOKEN`, `PUBLIC_ORIGIN` y un volumen persistente en `/app/backend/storage`. Fuera del entorno de prueba, `NODE_ENV=production` exige una URL pública HTTPS. Termina TLS en un proxy; configura `TRUST_PROXY=1` solamente si existe exactamente un proxy confiable y no es posible saltárselo. Nunca despliegues SQLite en un disco efímero ni uses varias réplicas sobre archivos independientes.

Todavía no hay un alojamiento público contratado o configurado. La entrega incluye el despliegue automático **temporal** de pruebas y la imagen preparada; publicar una instancia permanente requiere elegir el servidor, configurar HTTPS y respaldos y proporcionar sus secretos.

Referencias: [SQLite en Node.js](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [seguridad en Express](https://expressjs.com/en/advanced/best-practice-security.html), [ZAP Baseline](https://www.zaproxy.org/docs/docker/baseline-scan/), [cobertura en Jest](https://jestjs.io/docs/configuration#coveragethreshold-object).
