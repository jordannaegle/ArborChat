const { default: pngToIco } = require('png-to-ico')
const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const sourcePng = path.join(projectRoot, 'resources', 'icon.png')
const outputIco = path.join(projectRoot, 'resources', 'icon.ico')
const buildIco = path.join(projectRoot, 'build', 'icon.ico')

async function convertToIco() {
  try {
    console.log('Converting PNG to ICO...')
    const icoBuffer = await pngToIco(sourcePng)
    
    fs.writeFileSync(outputIco, icoBuffer)
    console.log('✓ Created:', outputIco)
    
    fs.writeFileSync(buildIco, icoBuffer)
    console.log('✓ Created:', buildIco)
    
    console.log('Done!')
  } catch (error) {
    console.error('Error:', error.message)
  }
}

convertToIco()
