export function configureRuntimeEnvironment(t, overrides = {}) {
  const settings = { VALDR_DB_USERNAME: 'eval-fixture-user', VALDR_DB_PASSWORD: 'eval-fixture-password', ...overrides }
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]))
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
}
