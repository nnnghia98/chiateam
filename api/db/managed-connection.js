// A URL sslmode option remains authoritative in pg. Otherwise production
// connections require TLS with normal certificate validation.
function managedConnectionOptions(connectionString, env = process.env) {
  return { connectionString, ...(env.NODE_ENV === 'production' ? {ssl:{rejectUnauthorized:true}} : {}) };
}
module.exports = { managedConnectionOptions };
