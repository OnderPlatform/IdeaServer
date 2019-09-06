#!/usr/bin/env node

import Options from '../config/Options'
import Main from '../Main'

async function main () {
  const options = await Options.build(process.argv)
  const main = new Main(options)
  return main.run()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
