// Valor de la cookie de sesión.
//
// POR QUÉ EXISTE: antes el middleware sólo comprobaba que la cookie jp_sesion
// EXISTIERA — cualquier valor inventado (jp_sesion=x) pasaba el login sin
// conocer la contraseña. La sesión válida es UNA: este token. El login lo
// emite tras verificar las credenciales y el middleware exige coincidencia
// exacta; una cookie forjada con otro valor rebota al login.
//
// Es una constante y no un secreto por variable de entorno porque el repo es
// privado y la app es monousuario; si el proyecto pasa a multiusuario, esto
// debe reemplazarse por sesiones firmadas por usuario (ver informe).
export const NOMBRE_COOKIE_SESION = "jp_sesion";
export const VALOR_SESION = "jp-s3s-7f2a9c41d8be4e06a35f71c2905dd218";
