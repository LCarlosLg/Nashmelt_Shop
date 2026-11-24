# Nashmelt — catálogo con cuentas de usuario

Catálogo de ropa con carrito, pedidos por WhatsApp, cuentas de clientes, panel de administración y base de datos.

## Cómo correrlo
1. Instala [Node.js **22.13 o superior**](https://nodejs.org) (trae SQLite incluido: no hay que instalar paquetes).
2. Abre esta carpeta en VS Code (`File > Open Folder`).
3. En la terminal: `npm start` (o `npm run dev` para reinicio automático). También funciona F5.
4. Tienda: http://localhost:3000 · Panel de administración: http://localhost:3000/#admin

La primera vez que arranca se crea `data/nashmelt.db` y la cuenta de administrador.

## Cuentas y sesiones
| | Cliente | Administrador |
|---|---|---|
| Cómo se crea | Se registra él mismo (siempre queda como **cliente**) | Se crea sola en el primer arranque |
| Dónde entra | Pantalla de acceso de la tienda (correo + contraseña) | `#admin` (usuario + contraseña) |
| Duración de la sesión | 7 días, se renueva cada vez que vuelve | Máx. 2 horas; se cierra tras 30 min sin actividad |
| Qué puede hacer | Ver el catálogo, carrito, favoritos, pedir por WhatsApp | Todo lo anterior + inventario, fotos y lista de clientes |

- **Puertas separadas:** un cliente no puede entrar por la puerta del administrador ni al revés, aunque use la contraseña correcta.
- **Cookie `nm_sid`:** `HttpOnly` (el JavaScript no puede leerla), `SameSite=Lax` y `Secure` cuando hay HTTPS. Guarda solo un
  identificador aleatorio; en la base de datos se guarda su hash.
- **Cada usuario tiene lo suyo:** carrito y favoritos se guardan en la base de datos, así que lo encuentra igual desde otro
  navegador o dispositivo. Se registra su actividad (registro, entradas, salidas y pedidos enviados por WhatsApp).
- Las contraseñas se guardan con **scrypt** (nunca en texto). Tras 5 intentos fallidos se bloquea el acceso 5 minutos.
- El servidor es quien decide los permisos: sin sesión no se entrega el catálogo, y solo el admin puede guardar productos,
  subir fotos o ver clientes.

### Contraseña del administrador
Usuario `admin`; la contraseña inicial está en `src/config.js` (`ADMIN_PASSWORD`) y solo se usa para crear la cuenta la primera vez.
**Cámbiala** y quita el valor del archivo:
```
npm run admin:password -- "TuNuevaContraseñaSegura"
```
(mínimo 12 caracteres; cierra las sesiones abiertas del admin). Para crearla desde el inicio con otra clave:
`ADMIN_PASSWORD=... npm start` antes del primer arranque.

## Base de datos (`data/nashmelt.db`, SQLite)
| Tabla | Contenido |
|---|---|
| `users` | Clientes y administrador: rol, nombre, correo, teléfono, hash de contraseña, fechas de registro / entrada / última visita |
| `sessions` | Una fila por navegador con sesión iniciada (cookie), con su caducidad |
| `user_state` | Carrito y favoritos de cada usuario |
| `activity` | Historial: `register`, `login`, `logout`, `order` |

Se puede abrir con cualquier visor de SQLite (por ejemplo la extensión *SQLite Viewer* de VS Code). Para respaldar, copia
`data/nashmelt.db`. Los productos siguen en `data/products.json`.

## Estructura
```
nashmelt/
├── server.js              Punto de entrada (comprueba Node, crea el admin, arranca)
├── package.json
├── scripts/
│   └── admin-password.js  Cambia la contraseña del administrador
├── data/
│   ├── products.json      Productos e inventario
│   └── nashmelt.db        Base de datos (se crea sola; no se sube a git)
├── src/                   BACKEND (Node, sin dependencias)
│   ├── config.js          Puerto, carpetas, límites, cookie y cuenta admin inicial
│   ├── app.js             Servidor HTTP: tabla de rutas con permisos (public / user / admin) + archivos estáticos
│   ├── db.js              SQLite: tablas y consultas
│   ├── auth.js            Contraseñas, sesiones por cookie, registro y login (cliente / admin)
│   ├── account.js         Carrito, favoritos, actividad y lista de clientes
│   ├── products.js        GET/PUT /api/products
│   ├── images.js          POST /api/images (sube fotos a public/img) y limpieza de fotos sin usar
│   └── http.js            Respuestas, cookies y lectura del cuerpo
└── public/                FRONTEND
    ├── index.html
    ├── css/               styles.css (tienda) · admin.css (login y panel)
    ├── js/                Módulos ES (sin bundler)
    │   ├── main.js        Arranque, sesión y rutas (tienda / #admin)
    │   ├── api.js         Todas las llamadas al servidor
    │   ├── auth.js        Formularios de login / registro / admin
    │   ├── state.js       Estado compartido, helpers de productos e imagen de reemplazo
    │   ├── catalog.js     Filtros, búsqueda, orden, cuadrícula y modal de producto
    │   ├── cart.js        Carrito, favoritos (sincronizados con el servidor) y pedido por WhatsApp
    │   ├── admin.js       Panel: inventario, formulario de prendas, fotos y clientes
    │   ├── config.js      Teléfono de WhatsApp, categorías, colores, tallas
    │   └── utils.js       Helpers (DOM, dinero, avisos) y paneles flotantes
    └── img/               Fotos de los productos
```

## Fotos de productos (`public/img/`)
- **Desde el panel:** al subir una foto se reduce a 900 px, se guarda aquí con nombre único (`prod-<fecha>-<id>.jpg`) y el
  producto guarda solo la ruta.
- **A mano:** copia tus fotos aquí y escribe la ruta en el formulario, por ejemplo `/img/vestido-azul.jpg`.
- JPG, PNG o WebP (máx. 8 MB). Las fotos subidas que ningún producto usa se borran solas tras 1 hora; las tuyas, nunca.

## Dónde cambiar cada cosa
| Qué | Dónde |
|---|---|
| Número de WhatsApp, categorías, colores, tallas | `public/js/config.js` |
| Colores de la marca | `public/css/styles.css` (sección 1) |
| Quién puede usar cada ruta de la API | `src/app.js` (tabla `API`) |
| Duración de sesiones, cuenta admin inicial | `src/config.js` |

## Para publicarlo en internet
- Sírvelo detrás de **HTTPS** (un proxy como Nginx o la plataforma de hosting) y arranca con `TRUST_PROXY=1` para que la cookie
  lleve `Secure`. Sin HTTPS las contraseñas viajarían sin cifrar.
- `HOST=0.0.0.0` para escuchar en la red; `PORT` para cambiar el puerto.
- Cambia la contraseña del admin (ver arriba).
- En el mensaje de WhatsApp las fotos salen como enlaces; funcionarán cuando el sitio tenga dominio público.
