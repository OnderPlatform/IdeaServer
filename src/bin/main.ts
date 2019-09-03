#!/usr/bin/env node

import Main from '../Main'

async function main () {
  const main = new Main()
  return main.run()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
