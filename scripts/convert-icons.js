const fs = require('fs')
const path = require('path')
const png2icons = require('png2icons')

const projectRoot = path.join(__dirname, '..')
const sourcePng = path.join(projectRoot, 'resources', 'icon.png')
const outputIco = path.join(projectRoot, 'resources', 'icon.ico')
const outputIcns = path.join(projectRoot, 'resources', 'icon.icns')
const buildIco = path.join(projectRoot, 'build', 'icon.ico')
const buildIcns = path.join(projectRoot, 'build', 'icon.icns')

async function convertIcons() {
  console.log('Reading source PNG...')
  const input = fs.readFileSync(sourcePng)

  console.log('Creating ICO file for Windows...')
  const ico = png2icons.createICO(input, png2icons.BICUBIC, 0, true)
  if (ico) {
    fs.writeFileSync(outputIco, ico)
    fs.writeFileSync(buildIco, ico)
    console.log('✓ Created:', outputIco)
    console.log('✓ Created:', buildIco)
  } else {
    console.error('✗ Failed to create ICO')
  }

  console.log('Creating ICNS file for macOS...')
  const icns = png2icons.createICNS(input, png2icons.BICUBIC, 0)
  if (icns) {
    fs.writeFileSync(outputIcns, icns)
    fs.writeFileSync(buildIcns, icns)
    console.log('✓ Created:', outputIcns)
    console.log('✓ Created:', buildIcns)
  } else {
    console.error('✗ Failed to create ICNS')
  }

  console.log('Done!')
}

convertIcons().catch(console.error)
