# Marcaje · demo

Demo pública e interactiva de **Marcaje**, un sistema de pase de lista con credenciales QR y NFC para escuelas: kiosco de entrada, pase de lista por retícula de lugares, credenciales imprimibles, entrada manual y reportes.

**Verla:** https://enriqueleondev.github.io/marcaje-demo/

> Todo es ficticio: la escuela "Plantel Demo", sus alumnos, docentes, códigos y registros son inventados. No hay servidor: el estado vive en el `localStorage` de tu navegador y se borra con "Reiniciar demo".

## Qué probar

- **Entrar** como Dirección o Docente (cuentas de prueba en la pantalla de acceso, sin contraseña).
- **Kiosco:** teclea un código y pulsa Enter, como lo hace un lector USB, o usa "Simular lectura". Repite la misma lectura para ver el anti-duplicado de 5 minutos. El Kiosco 1 está en modo "Ambos": activa la cámara y muéstrale un QR ("Mostrar un QR de prueba" lo abre en otro dispositivo). El modo de cada kiosco se cambia en Ajustes.
- **Pase de lista:** toca un lugar o usa `P`, `R`, `F`; "Confirmar todas las entradas"; "Acomodar lugares" para arrastrar.
- **Alumnos:** QR real y escaneable, regenerar, vincular una pegatina NFC, imprimir credenciales.
- **Entrada manual**, **Reportes** (con exportación CSV) y **Ajustes**.

## Cómo está hecha

HTML, CSS y JavaScript en módulos, sin dependencias en tiempo de ejecución ni paso de compilación. Usa el mismo diseño y las mismas reglas que la app real (Laravel 13 + Livewire, en un repositorio privado). Fuentes y librería de QR se sirven desde el propio sitio: sin recursos de terceros, sin cookies, sin analíticas.

Para correrla en local: `python3 -m http.server` en esta carpeta y abre http://localhost:8000.

## Créditos y licencias de terceros

- Tipografías [Instrument Serif](https://github.com/Instrument/instrument-serif) y [Geist](https://github.com/vercel/geist-font), SIL Open Font License 1.1 (`assets/fonts/LICENSE-*.txt`).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase, licencia MIT (`assets/vendor/qrcode.js`).
- [@zxing/library](https://github.com/zxing-js/library), licencia Apache 2.0 (`assets/vendor/zxing.min.js`, `assets/vendor/LICENSE-zxing.txt`): lector de QR de respaldo para la cámara del kiosco cuando el navegador no trae `BarcodeDetector`.

## Legal

[Aviso de privacidad](legal/privacidad.html) · [Términos de uso](legal/terminos.html) · [Política de cookies](legal/cookies.html) · [Aviso de demostración](legal/demo.html)

Autor: Enrique Rentería León, [enriqueleondev.github.io](https://enriqueleondev.github.io/).
