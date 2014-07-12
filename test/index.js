var assert = require('assert')
var fs     = require('fs')
var path   = require('path')
var rm     = require('rimraf')
var husky  = require('../src/')

// Some very basic tests...

husky.hooksDir(function(err, dir) {
  assert.equal(err, null)
  assert.equal(dir, path.resolve(__dirname + '/../.git/hooks'))
})

// Create tmp dir
var dir = __dirname + '/../tmp'

rm.sync(dir)
fs.mkdirSync(dir)

// husky should be able to create a hook and update it
assert.doesNotThrow(function() {
  husky.create(dir, 'pre-commit', 'foo')
})

assert.doesNotThrow(function() {
  husky.create(dir, 'pre-commit', 'bar')
})

assert(fs.readFileSync(dir + '/pre-commit', 'utf-8').indexOf('bar') !== -1)

// husky should be able to remove a hook it has created
husky.remove(dir, 'pre-commit')
assert(!fs.existsSync(dir + '/pre-commit'))

// husky shouldn't be able to modify a user hook
fs.writeFileSync(dir + '/user-pre-commit', '')

husky.create(dir, 'user-pre-commit', 'foo')
husky.remove(dir, 'user-pre-commit')

assert.equal(fs.readFileSync(dir + '/user-pre-commit', 'utf-8'), '')