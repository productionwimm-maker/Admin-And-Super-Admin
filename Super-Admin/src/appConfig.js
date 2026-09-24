// Per-portal configuration. This is the SUPER ADMIN portal.
// Only accounts with role 'superadmin' may sign in here; plain Admins use the
// separate Admin portal build (requiredRole: 'admin').
export const appConfig = {
  appName: 'Super Admin Console',
  portal: 'superadmin',
  requiredRole: 'superadmin',
}
