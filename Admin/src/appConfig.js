// Per-portal configuration. This is the ADMIN portal.
// Only accounts with the matching role may sign in here; the Super Admin
// portal is a separate build with requiredRole: 'superadmin'.
export const appConfig = {
  appName: 'Admin Console',
  portal: 'admin',
  requiredRole: 'admin',
}
