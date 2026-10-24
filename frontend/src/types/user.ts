export interface UserRole {
  id: string;
  code: string;
  name: string;
}

/** Perfil del usuario en sesión (`GET /api/users/me/`). Los permisos solo sirven para
 * mostrar u ocultar acciones: la autorización real la valida el backend en cada endpoint. */
export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  roles: UserRole[];
  permissions: string[];
}
