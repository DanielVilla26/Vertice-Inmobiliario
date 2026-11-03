# 🏠 Vértice Inmobiliario

Aplicación web para consultar propiedades en alquiler y agendar visitas.
Proyecto académico hecho con Node.js, Express y SQLite (sql.js).

## Funcionalidades

- Registro, inicio de sesión y recuperación de contraseña, con una pantalla de acceso con fondo ilustrado
  (`public/img/login-fondo.svg`), el logo de la inmobiliaria (`public/img/logo.png`) y botón para ver u ocultar la contraseña
- Catálogo de propiedades con filtros (ciudad, precio, tipo, habitaciones...)
- **Reglas por propiedad:** máximo de personas, mascotas, fumar y fiestas/eventos (se ven en las tarjetas, el detalle
  y el comparador; se pueden filtrar y se validan al agendar una visita)
- Galería de imágenes, favoritos y comparador de propiedades
- Agenda de visitas con calendario y control de horarios ocupados
- **Reseñas y calificaciones** (1 a 5 estrellas) de cada propiedad, con promedio en las tarjetas
- **Mapa** con la ubicación de cada propiedad (OpenStreetMap)
- **Correos reales** con Gmail (opcional)
- Chat en tiempo real entre usuario y administrador (Socket.io)
- Notificaciones dentro de la app y por correo
- Panel de administración: propiedades, reservas, usuarios y estadísticas
- **Resumen de actividad** del admin: reservas confirmadas/canceladas, favoritos, promedio de reseñas,
  gráfica de los últimos 6 meses (usuarios, propiedades y reservas) y rankings de propiedades más
  guardadas y mejor valoradas
- Reportes en Excel y PDF
- Modo claro / oscuro

## Cómo ejecutarlo

Requiere [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install
npm start
```

Luego abre http://localhost:3000

## Usuario administrador por defecto

| Email                 | Contraseña |
|-----------------------|------------|
| admin@verticeinmobiliario.com   | admin123   |

Se crea automáticamente la primera vez que arranca la app.

## Fotos de las propiedades

Las propiedades de ejemplo usan ilustraciones locales (`public/img/propiedades/`), así nunca se rompen por falta de
internet. Al subir fotos reales desde el panel (editar propiedad → *Imágenes*) estas reemplazan a la ilustración.
Si alguna foto falla al cargar, se muestra `public/img/sin-foto.svg`.

## Reglas de las propiedades

El admin las define en el formulario de propiedades:

- **Máx. de personas:** un número (0 = sin límite).
- **Mascotas / Fumar / Fiestas y eventos:** se permiten o no.

Al agendar una visita, el usuario indica cuántas personas vivirían y si tiene mascotas; si no cumple las reglas
de la propiedad, el servidor rechaza la reserva con un mensaje claro. Esos datos quedan en la nota de la reserva.
Las propiedades que ya existían quedan "sin límite y todo permitido" hasta que el admin las edite
(las 6 de ejemplo traen reglas de muestra).

## Resumen de actividad (admin)

Al entrar como administrador, arriba del panel aparece el resumen. Se calcula con los datos reales de la
base de datos cada vez que se abre o recarga el panel:

- **Gráfica de 6 meses:** registros nuevos por mes de usuarios, propiedades y reservas (el mes actual es el último).
- **Más guardadas:** top 5 de propiedades según cuántas personas las marcaron como favoritas.
- **Mejor valoradas:** top 5 según el promedio de sus reseñas.

## Reseñas

- Cualquier usuario registrado (no el admin) puede calificar una propiedad de 1 a 5 estrellas y dejar un comentario.
- Cada persona tiene **una reseña por propiedad**: si vuelve a opinar, se actualiza la anterior.
- Cada quien puede borrar la suya; el admin puede borrar cualquiera.

## Mapa

- En el detalle de cada propiedad aparece su ubicación.
- El admin la define en el formulario de propiedades: **clic en el mapa**, arrastrar el marcador o el botón
  *Buscar la dirección*. Si la deja vacía, la app intenta ubicarla sola con la dirección.
- Las propiedades sin coordenadas se ubican por su dirección (o por la ciudad, de forma aproximada).
- Necesita internet (usa Leaflet, OpenStreetMap y el buscador Nominatim, todos gratis y sin clave).

## Correos reales con Gmail

Por defecto los correos son de prueba. Para que lleguen a bandejas reales:

1. En tu cuenta de Google activa la **verificación en 2 pasos**.
2. Entra a https://myaccount.google.com/apppasswords y crea una **contraseña de aplicación**
   (Google te muestra 16 letras, algo como `abcd efgh ijkl mnop`).
3. En la carpeta del proyecto copia `.env.example` como `.env` y llena `GMAIL_USER` y `GMAIL_APP_PASSWORD`.
   Pon también `ADMIN_NOTIFY_EMAIL` con el correo donde quieres recibir los avisos de reservas.
4. Reinicia con `npm start`. Si todo está bien, la consola dirá **"✅ Gmail: credenciales correctas"**.

Los correos a direcciones `@verticeinmobiliario.com` (como el admin de ejemplo) se omiten porque no existen.
Gmail permite unos 500 envíos por día con una cuenta personal.

## Notas

- **Recuperar contraseña:** se pide el email y el teléfono con el que se registró la cuenta.
  Si una cuenta no tiene teléfono (por ejemplo, el admin), se puede agregar desde *Perfil*.
- **Correos sin configurar Gmail:** usan [Ethereal](https://ethereal.email), un servicio de pruebas.
  No llegan a bandejas reales; la consola muestra el enlace para verlos.
- La base de datos se guarda en `data.sqlite` y las fotos subidas en `public/uploads/`
  (ambos se crean solos y están en `.gitignore`). El archivo `.env` también está ignorado.

## Estructura

```
server.js        API REST, sesiones, reseñas, reportes y chat (Socket.io)
env.js           Lee el archivo .env (credenciales de Gmail)
database.js      Tablas, datos iniciales y funciones de acceso a SQLite
mailer.js        Plantillas y envío de correos (Gmail real o pruebas)
public/          Frontend (index.html, css/ y js/ con un archivo por módulo)
```
