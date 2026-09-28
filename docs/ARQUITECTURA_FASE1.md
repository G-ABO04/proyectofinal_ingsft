# Documentación de Arquitectura: DonativoSeguro (Fase 1)

## 1. Visión General

El sistema **DonativoSeguro** ha sido diseñado bajo una arquitectura orientada a microservicios para asegurar el desacoplamiento, la escalabilidad y la fácil mantenibilidad del código. 

Esta documentación describe la **Fase 1 (V1)** del sistema, orientada a cubrir las necesidades fundamentales de operación de la organización: captación, registro de donantes, gestión de donativos y control básico de gastos. 

Para mantener un enfoque ágil y lanzar el producto principal al menor tiempo posible, algunas características avanzadas han sido deliberadamente programadas para una **Fase 2 (V2)**.

## 2. Diagrama de Arquitectura (V1)

```mermaid
flowchart TD
    Client[Cliente / Navegador HTML+JS] -->|HTTP/REST| APIGW[API Gateway]
    
    subgraph Microservicios Fase 1
        APIGW -->|/api/auth| Auth[Auth Service]
        APIGW -->|/api/donantes| Donor[Donor Service]
        APIGW -->|/api/donativos| Donation[Donation Service]
        APIGW -->|/api/gastos| Expense[Expense Service]
    end

    Auth -.-> DB[(Base de Datos Compartida<br>SQLite)]
    Donor -.-> DB
    Donation -.-> DB
    Expense -.-> DB

    subgraph Hoja de Ruta (V2)
        UserSvc[User Service]
        TaxSvc[Tax Service]
        AccSvc[Accounting Service]
    end
    
    classDef future fill:#f9f9f9,stroke:#ccc,stroke-dasharray: 5 5;
    class UserSvc,TaxSvc,AccSvc future;
```

## 3. Componentes del Sistema (Fase 1)

La Fase 1 se compone exclusivamente de los siguientes servicios en contenedor. 

### 3.1. API Gateway (`api-gateway`)
- **Responsabilidad:** Actúa como el punto de entrada único (Single Point of Entry) para todas las solicitudes del cliente. 
- **Funciones:**
  - Enrutamiento inverso (Reverse Proxy) hacia los microservicios correspondientes según la ruta solicitada.
  - Servir los archivos estáticos del frontend (HTML, CSS, JS).
  - Centralizar la configuración de puertos expuestos (Puerto 3000) hacia el exterior.

### 3.2. Servicio de Autenticación (`auth-service`)
- **Responsabilidad:** Proveer mecanismos de inicio y cierre de sesión.
- **Funciones:**
  - Validar credenciales de acceso (email y contraseña hash).
  - Emisión y validación de JSON Web Tokens (JWT).
  - Gestión básica de sesiones activas. 
  *(Nota: La administración avanzada de roles de empleados está delegada para la V2).*

### 3.3. Servicio de Donantes (`donor-service`)
- **Responsabilidad:** Gestionar el directorio y perfil de las personas o entidades que realizan las aportaciones.
- **Funciones:**
  - Operaciones CRUD (Crear, Leer, Actualizar, Borrar) para las fichas de los donantes.
  - Asegurar que no existan registros duplicados.
  - Mantener la privacidad de los datos personales.

### 3.4. Servicio de Donativos (`donation-service`)
- **Responsabilidad:** Registrar el ingreso y estado de las aportaciones monetarias o en especie.
- **Funciones:**
  - Capturar nuevos donativos asociados a un donante.
  - Gestión de estados (Pendiente, Verificado).
  - Proporcionar historial de donativos al frontend.

### 3.5. Servicio de Gastos (`expense-service`)
- **Responsabilidad:** Llevar un registro básico de las salidas de dinero (egresos) de la organización.
- **Funciones:**
  - Registro de gastos operativos.
  - Permitir a la organización tener control de caja a nivel elemental sin las complejidades de un sistema contable.

## 4. Persistencia de Datos
En esta primera fase, se utiliza un patrón de **Base de Datos Compartida (Shared Database)** mediante SQLite. Todos los microservicios de la Fase 1 mapean el mismo volumen de datos (`/app/database/donativoseguro.sqlite`). 

Esto facilita la consistencia transaccional y el despliegue rápido inicial, evitando la complejidad técnica de la sincronización de datos distribuidos en el MVP.

## 5. Hoja de Ruta: Servicios Diferidos a la Fase 2 (V2)

Con el objetivo de enfocarse en el *Core* del producto, se tomó la decisión técnica de omitir los siguientes microservicios de la arquitectura actual. Se integrarán en la **V2**:

> [!NOTE] Crecimiento Modular
> La infraestructura basada en Docker Compose y API Gateway está preparada para integrar estos 3 microservicios sin interrumpir la operación actual cuando se decida desarrollarlos en el futuro.

### 5.1. User Service (`user-service`)
* **Estado:** Planificado para V2.
* **Justificación:** Puede agregarse después para administrar empleados/voluntarios y permisos de forma más completa. Durante la Fase 1, la autenticación básica se maneja directamente de manera pragmática acoplada en el `auth-service`.

### 5.2. Tax Service (`tax-service`)
* **Estado:** Planificado para V2.
* **Justificación:** La generación de comprobantes fiscales puede plantearse como una ampliación posterior. Requiere integraciones adicionales y flujos normativos (ej. CFDI, facturación electrónica) que no bloquean la validación del núcleo del negocio.

### 5.3. Accounting Service (`accounting-service`)
* **Estado:** Planificado para V2.
* **Justificación:** Los balances y reportes financieros avanzados pueden incorporarse cuando ya estén consolidados de manera estable los ingresos (vía `donation-service`) y egresos (vía `expense-service`). 

## 6. Seguridad y Comunicación
- **Comunicación Interna:** Las peticiones desde el `api-gateway` hacia los servicios internos ocurren de manera síncrona vía HTTP dentro de la red privada de Docker, de forma que los microservicios son inaccesibles directamente desde el exterior.
- **Autenticación en Servicios:** El API Gateway o los servicios individuales verifican la cabecera `Authorization` con el JWT emitido, asegurando que las rutas protegidas no puedan ser ejecutadas sin una sesión válida y el nivel de acceso correcto.
