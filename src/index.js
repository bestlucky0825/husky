var fs = require('fs')
var path = require('path')
var normalize = require('normalize-path')
var findParentDir = require('find-parent-dir')
var hooks = require('./hooks.json')
var pkg = require('../package.json')

function write (filename, data) {
  fs.writeFileSync(filename, data)
  fs.chmodSync(filename, parseInt('0755', 8))
}

function isHusky (filename) {
  var data = fs.readFileSync(filename, 'utf-8')
  return data.indexOf('#husky') !== -1
}

function findHooksDir (dirname) {
  var dir = findParentDir.sync(dirname, '.git')

  if (dir) {
    var gitDir = path.join(dir, '.git')
    var stats = fs.lstatSync(gitDir)

    if (stats.isFile()) {
      // Expect following format
      // git: pathToGit
      gitDir = fs
        .readFileSync(gitDir, 'utf-8')
        .split(':')[1]
        .trim()

      return path.join(dir, gitDir, 'hooks')
    }

    return path.join(gitDir, 'hooks')
  }
}

function getHookScript (hookName, relativePath, cmd) {
    // On Windows normalize path (i.e. convert \ to /)
  var normalizedPath = normalize(relativePath)

  // Hook script
  var arr = [
    '#!/bin/sh',
    '#husky ' + pkg.version,
    '',
    'command_exists () {',
    '  command -v "$1" >/dev/null 2>&1',
    '}',
    '',

    'load_nvm () {',
    '  export $1=$2',
    '  [ -s "$1/nvm.sh" ] && . $1/nvm.sh',
    '  exists nvm && [ -f .nvmrc ] && nvm use',
    '}',
    '',

    'has_hook_script () {',
    '  [ -f package.json ] && cat package.json | grep -q \'"$1"\\s*:\'',
    '}',
    ''
  ]

  arr = arr.concat([
    'cd ' + normalizedPath,
    '',
    // Fix for issue #16 #24
    // If script is not defined in package.json then exit
    'has_hook_script ' + cmd + ' || exit 0',
    ''
  ])

  // On OS X and Linux, try to use nvm if it's installed
  if (process.platform !== 'win32') {
    // ~ is unavaible, so $HOME is used
    var home = process.env.HOME

    if (process.platform === 'darwin') {
      // Add
      // Brew standard installation path /use/local/bin
      // Node standard installation path /usr/local
      // for GUI apps
      // https://github.com/typicode/husky/issues/49
      arr = arr.concat([
        'export PATH=$PATH:/usr/local/bin:/usr/local'
      ])
    }

    if (process.platform === 'darwin') {
      arr = arr.concat([
        'exists npm || load_nvm BREW_NVM_DIR /usr/local/opt/nvm',
        ''
      ])
    }

    arr = arr.concat([
      'exists npm || load_nvm NVM_DIR ' + home + '/.nvm',
      ''
    ])
  } else {
    // Add
    // Node standard installation path /c/Program Files/nodejs
    // for GUI apps
    // https://github.com/typicode/husky/issues/49
    arr = arr.concat([
      'export PATH="$PATH:/c/Program Files/nodejs"'
    ])
  }

  // Can't find npm message
  var npmNotFound = 'husky > can\'t find npm in PATH. Skipping ' + cmd + ' script in package.json'

  arr = arr.concat([
    // Test if npm is in PATH
    'exists npm || {',
    '  echo >&2 "' + npmNotFound + '"',
    '  exit 0',
    '}',
    '',

    // Run script
    'echo',
    'echo "husky > npm run -s ' + cmd,
    'echo',
    '',

    'export GIT_PARAMS="$*"',
    'npm run -s ' + cmd + ' || {',
    '  echo',
    '  echo "husky > ' + hookName + ' hook failed (add --no-verify to bypass)"',
    '  echo "husky > To debug, use \'npm run precommit\'',
    '  exit 1',
    '}',
    ''
  ])

  return arr.join('\n')
}

function createHook (huskyDir, hooksDir, hookName, cmd) {
  var filename = path.join(hooksDir, hookName)

  // Assuming that this file is in node_modules/husky
  var packageDir = path.join(huskyDir, '..', '..')

  // Get project directory
  // When used in submodule, the project dir is the first .git that is found
  var projectDir = findParentDir.sync(huskyDir, '.git')

  // In order to support projects with package.json in a different directory
  // than .git, find relative path from project directory to package.json
  var relativePath = path.join('.', path.relative(projectDir, packageDir))

  var hookScript = getHookScript(hookName, relativePath, cmd)

  // Create hooks directory if needed
  if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir)

  if (!fs.existsSync(filename)) {
    write(filename, hookScript)
  } else {
    if (isHusky(filename)) {
      write(filename, hookScript)
    } else {
      console.log('skipping ' + hookName + ' hook (existing user hook)')
    }
  }
}

function removeHook (dir, name) {
  var filename = dir + '/' + name

  if (fs.existsSync(filename) && isHusky(filename)) {
    fs.unlinkSync(dir + '/' + name)
  }
}

function installFrom (huskyDir) {
  try {
    var hooksDir = findHooksDir(huskyDir)

    if (hooksDir) {
      hooks.forEach(function (hookName) {
        var npmScriptName = hookName.replace(/-/g, '')
        createHook(huskyDir, hooksDir, hookName, npmScriptName)
      })
      console.log('done\n')
    } else {
      console.log('Can\'t find .git directory, skipping Git hooks installation')
    }
  } catch (e) {
    console.error(e)
  }
}

function uninstallFrom (huskyDir) {
  try {
    var hooksDir = findHooksDir(huskyDir)

    hooks.forEach(function (hookName) {
      removeHook(hooksDir, hookName)
    })
    console.log('done\n')
  } catch (e) {
    console.error(e)
  }
}

module.exports = {
  installFrom: installFrom,
  uninstallFrom: uninstallFrom
}
