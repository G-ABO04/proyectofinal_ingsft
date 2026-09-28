# REPORTE TÉCNICO DE ARQUITECTURA E IMPLEMENTACIÓN
**Proyecto:** DonativoSeguro
**Fase:** 1 (V1)
**Enfoque:** Arquitectura de Software, Stack Tecnológico e Implementación Técnica

---

## 1. STACK TECNOLÓGICO Y ENTORNO DE EJECUCIÓN

El sistema ha sido construido sobre un stack de tecnologías moderno, priorizando el rendimiento I/O y la facilidad de despliegue mediante contenedorización:
* **Entorno de Ejecución:** Node.js v24+ (Rama 24 LTS).
* **Framework Web:** Express.js (para la creación de la API REST y el enrutamiento del Gateway).
* **Base de Datos:** SQLite3 (Motor relacional embebido, configurado con archivos `-wal` y `-shm` para concurrencia básica).
* **Frontend:** HTML5, CSS3, y JavaScript Vanilla modular (`js/scrip.js`), servido estáticamente por el backend.
* **Despliegue y Orquestación:** Docker y Docker Compose para aislar el entorno de red de los microservicios.

---

## 2. ARQUITECTURA DEL SISTEMA Y ENRUTAMIENTO

El sistema implementa una **Arquitectura de Microservicios basada en un API Gateway**, orquestada de forma estática mediante Docker Compose.

### 2.1 Implementación del API Gateway
El servicio `api-gateway` se ejecuta como el único punto expuesto al mundo exterior (mapeado al puerto TCP 3000 del host). 
* **Enrutamiento Interno (Reverse Proxy):** Intercepta las solicitudes HTTP que ingresan al prefijo `/api/*` y utiliza un proxy inverso para retransmitir los paquetes hacia la red interna de Docker, donde los microservicios individuales escuchan en los puertos 3001 a 3005. 
* **Servicio de Estáticos:** Las rutas que no coinciden con la API se redirigen al volumen compartido de `/app/frontend`, sirviendo la interfaz de usuario de manera unificada.

### 2.2 Topología de Red y Componentes (Fase 1)
Dentro de la red virtual de Docker Compose, operan de forma aislada los siguientes contenedores:
1. **`auth-service` (Puerto 3001):** Implementa los controladores de las rutas `/api/auth/login`, `/api/auth/setup` y `/api/auth/profile`. Resuelve la criptografía de contraseñas.
2. **`donor-service` (Puerto 3003):** Expone las rutas de recursos `/api/donantes`. Gestiona las operaciones CRUD de los perfiles de benefactores y previene la duplicidad de registros.
3. **`donation-service` (Puerto 3004):** Gestiona los flujos de `/api/donativos`. Implementa la lógica transaccional de ingresos de dinero en centavos (para evitar problemas de precisión de punto flotante) y transiciones de estado (ej. "Pendiente" -> "Verificado").
4. **`expense-service` (Puerto 3005):** Atiende las peticiones transaccionales básicas de salidas operativas.

---

## 3. CAPA DE DATOS Y PERSISTENCIA (Shared Database Pattern)

Para la Fase 1, se diseñó una arquitectura de datos pragmática bajo el patrón **Shared Database**. En lugar de asignar un clúster físico diferente a cada servicio, todos los microservicios montan el volumen de almacenamiento persistente (`/app/database/donativoseguro.sqlite`).

### 3.1 Modelo Relacional
La integridad referencial recae en las claves foráneas de SQLite. El esquema interno se divide en cuatro tablas principales:
* **`users`**: Almacena el correo electrónico (Unique Constraint), el hash con sal generada, el rol (Administrador/Usuario) y el estado lógico de la cuenta.
* **`donors`**: Fichas maestras de los donantes, relacionadas de forma opcional con `users` (para el caso de donantes que poseen cuenta de acceso).
* **`donations`**: Almacena los importes procesados como enteros (centavos), llaves foráneas apuntando a `donors` y firmas de auditoría (quién registró y quién verificó).
* **`sessions`**: Mantiene un registro en caliente de cada token de sesión emitido, el usuario propietario y su vencimiento exacto.

### 3.2 Seguridad en las Consultas
Para evitar vulnerabilidades de Inyección SQL (CWE-89), la capa de abstracción de datos (`src/database.js`) procesa *exclusivamente* sentencias SQL parametrizadas y bloqueos transaccionales a la hora de efectuar escrituras dependientes. No existe concatenación dinámica de entradas de usuario.

---

## 4. IMPLEMENTACIÓN DE SEGURIDAD Y AUTENTICACIÓN

La plataforma integra múltiples capas de seguridad, tanto a nivel de aplicación como criptográfico:

### 4.1 Criptografía y Hashes
* Las contraseñas en texto plano nunca tocan la base de datos ni los logs. Al recibirse, se someten al algoritmo de derivación de claves **`scrypt`** utilizando un buffer de "Sal" (Salt) aleatorio único por cada usuario, neutralizando ataques de diccionarios o Rainbow Tables.

### 4.2 Arquitectura Stateless de JWT (JSON Web Tokens)
* Tras una validación exitosa, el `auth-service` firma un token **JWT con el algoritmo HS256**. El secreto (`JWT_SECRET`) se inyecta estrictamente a través de variables de entorno (`.env`) y no está versionado.
* **Ciclo de Vida:** El token incluye un Emisor (Issuer), Audiencia y tiene una expiración dura (TTL) de 30 minutos.
* **Revocación Activa:** Aunque el token es válido por sí mismo, la arquitectura verifica su huella contra la tabla de base de datos `sessions`. Si un usuario cierra sesión, se cambia de rol, o la cuenta es desactivada, la fila se elimina y el token JWT se invalida inmediatamente, combinando las ventajas del protocolo Stateless con la seguridad Stateful.

### 4.3 Endurecimiento del Servidor (Server Hardening)
* El API incluye cabeceras de seguridad mediante el middleware **Helmet** y una política de seguridad de contenido (CSP) estricta para mitigar Cross-Site Scripting (XSS).
* Los tokens JWT en el frontend se persisten exclusivamente en `sessionStorage` (aislados por pestaña) reduciendo el área de exposición frente al robo prolongado de credenciales.

---

## 5. INTEGRACIÓN CONTINUA Y CALIDAD (CI/CD)

El sistema incluye una tubería (Pipeline) automatizada en GitHub Actions (`.github/workflows/quality.yml`) que garantiza que el código de la Fase 1 cumple con los estándares de ingeniería antes de ser fusionado a producción.

* **Testing (Jest & Supertest):** El código backend cuenta con un umbral estricto (Coverage Threshold) del 80% en líneas, sentencias, funciones y ramas de control. El servidor principal (`server.js`) se instancia bajo demanda durante los test E2E.
* **Análisis Estático (SAST):** Configuración de `sonar-project.properties` preparada para análisis local y remoto con SonarQube, rastreando Code Smells y vulnerabilidades del código.
* **Análisis Dinámico (DAST):** Durante la compilación, Actions levanta una instancia *sandbox* temporal y ejecuta el **OWASP ZAP Baseline Scan** simulando peticiones de usuarios para descubrir brechas de red antes del despliegue.

---

## 6. ARQUITECTURA MODULAR DIFERIDA: SERVICIOS V2

Durante el diseño de la arquitectura y la separación en contenedores, se identificaron dominios de altísima complejidad técnica que podrían comprometer la estabilidad y el tiempo de salida a producción de la plataforma inicial. Se establecieron las siguientes restricciones para implementarse obligatoriamente en V2:

### 6.1 `user-service` (Administración Compleja de Identidades)
**Detalles Técnicos:** Delegado a la V2 para implementar un control de accesos basado en atributos (ABAC). En la Fase 1, `auth-service` asume la responsabilidad del RBAC simple (Role-Based Access Control - Admin/Usuario). El `user-service` requerirá rediseñar el esquema de base de datos para soportar estructuras de árbol organizacionales y permisos granulares de empleados/voluntarios que no son necesarios para validar el producto inicial.

### 6.2 `tax-service` (Motor Fiscal)
**Detalles Técnicos:** La generación automática de recibos deducibles requiere flujos asíncronos pesados. Implementarlo implicaría añadir un contenedor con un *Message Broker* (ej. RabbitMQ), integrarse con APIs gubernamentales por SOAP/REST, y manejar certificados criptográficos (.cer / .key). Por complejidad y dependencias externas de tiempo de ejecución, la generación de comprobantes fiscales se aislará en V2.

### 6.3 `accounting-service` (Reporteo Financiero)
**Detalles Técnicos:** Los servicios actuales `donation-service` y `expense-service` operan transaccionalmente de forma atómica y aislada. Implementar contabilidad avanzada exige un diseño de *Partida Doble* y bloqueo optimista (Optimistic Locking) avanzado de registros. Esta agregación analítica de balances financieros se integrará cuando las bases de datos de flujos simples alcancen un punto de madurez que permita crear procesos batch nocturnos de consolidación en V2.
