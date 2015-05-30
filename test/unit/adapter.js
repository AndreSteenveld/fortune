import test from 'tape'
import Adapter from '../../lib/adapter'
import * as arrayProxy from '../../lib/common/array_proxy'
import * as keys from '../../lib/common/reserved_keys'
import * as errors from '../../lib/common/errors'
import * as stderr from '../stderr'


const type = 'user'

const schemas = {
  user: {
    name: { type: String },
    age: { type: Number },
    isAlive: { type: Boolean },
    birthday: { type: Date },
    junk: { type: Object },
    picture: { type: Buffer },
    nicknames: { type: String, isArray: true },
    friends: { link: 'user', isArray: true, inverse: 'friends' },
    bestFriend: { link: 'user', inverse: 'bestFriend' }
  }
}

const deadbeef = new Buffer(4)
deadbeef.writeUInt32BE(0xdeadbeef, 0)

const records = [
  {
    id: 1,
    name: 'bob',
    age: 42,
    isAlive: true,
    junk: { things: [ 'a', 'b', 'c' ] },
    birthday: new Date(),
    friends: [ 2 ],
    bestFriend: 2
  }, {
    id: 2,
    name: 'john',
    age: 36,
    isAlive: false,
    picture: deadbeef,
    friends: [ 1 ],
    bestFriend: 1
  }
]


export default (adapter, options) => {
  const run = runTest.bind(null, adapter, options)

  test('find: nothing', run((t, adapter) =>
    adapter.find(type, [])
    .then(records => {
      t.equal(records.count, 0, 'count is correct')
    })
  ))

  test('find: collection', run((t, adapter) =>
    adapter.find(type)
    .then(records => {
      t.equal(records.count, 2, 'count is correct')
    })
  ))

  test('find: match (string)', run((t, adapter) =>
    adapter.find(type, null, { match: { name: 'john' } })
    .then(records => {
      t.equal(records.length, 1, 'match length is correct')
      t.equal(records[0].name, 'john', 'matched correct record')
    })
  ))

  test('find: match (buffer)', run((t, adapter) =>
    adapter.find(type, null, { match: { picture: deadbeef } })
    .then(records => {
      t.equal(records.length, 1, 'match length is correct')
      t.ok(records[0].picture.equals(deadbeef), 'matched correct record')
    })
  ))

  test('find: sort ascending', run((t, adapter) =>
    adapter.find(type, null, { sort: { age: 1 } })
    .then(records => {
      t.deepEqual(records.map(record => record.age), [ 36, 42 ],
        'ascending sort order correct')
    })
  ))

  test('find: sort descending', run((t, adapter) =>
    adapter.find(type, null, { sort: { age: -1 } })
    .then(records => {
      t.deepEqual(records.map(record => record.age), [ 42, 36 ],
        'descending sort order correct')
    })
  ))

  test('find: limit', run((t, adapter) =>
    adapter.find(type, null, { limit: 1 })
    .then(records => {
      t.equal(records.length, 1, 'limit length is correct')
    })
  ))

  test('find: offset', run((t, adapter) =>
    adapter.find(type, null, { offset: 1 })
    .then(records => {
      t.equal(records.length, 1, 'offset length is correct')
    })
  ))

  test('find: fields', run((t, adapter) =>
    adapter.find(type, null, { fields: { name: true, isAlive: true } })
    .then(records => {
      t.deepEqual(records.map(record => Object.keys(record).length),
        // We expect 3 fields, because we always get ID.
        Array.from({ length: records.length }).map(() => 3),
        'fields length is correct')
    })
  ))

  test('update: replace', run((t, adapter) =>
    adapter.update(type, [
      { id: 1, replace: { name: 'billy' } },
      { id: 2, replace: { name: 'billy' } }
    ])
    .then(number => {
      t.equal(number, 2, 'number updated correct')
      return adapter.find(type)
    })
    .then(records => {
      t.equal(records.filter(record => record.name !== 'billy').length,
        0, 'field updated on set')
    })
  ))

  test('update: unset', run((t, adapter) =>
    adapter.update(type, [
      { id: 1, replace: { name: null } },
      { id: 2, replace: { name: null } }
    ])
    .then(number => {
      t.equal(number, 2, 'number updated correct')
      return adapter.find(type)
    })
    .then(records => {
      t.equal(records.filter(record => record.name !== null).length,
        0, 'field updated on unset')
    })
  ))

  test('update: push', run((t, adapter) =>
    adapter.update(type, [
      { id: 1, push: { friends: 5 } },
      { id: 2, push: { friends: [ 5 ] } }
    ])
    .then(number => {
      t.equal(number, 2, 'number updated correct')
      return adapter.find(type)
    })
    .then(records => {
      t.equal(records.filter(record =>
        arrayProxy.includes(record.friends, 5)).length,
        records.length, 'value pushed')
    })
  ))

  test('update: pull', run((t, adapter) =>
    adapter.update(type, [
      { id: 1, pull: { friends: 2 } },
      { id: 2, pull: { friends: [ 1 ] } }
    ])
    .then(number => {
      t.equal(number, 2, 'number updated correct')
      return adapter.find(type)
    })
    .then(records => {
      t.equal(records.filter(record => record.friends.length).length,
        0, 'value pulled')
    })
  ))
}


function runTest (a, options, fn) {
  // Check if it's a class or a dependency injection function.
  try { a = a(Adapter) }
  catch (error) { if (!(error instanceof TypeError)) throw error }

  const A = a
  const adapter = new A({
    options: options || {},
    keys, errors, schemas
  })

  return t => adapter.connect()
  .then(() => adapter.delete(type))
  .then(() => adapter.create(type, records))
  .then(r => {
    t.equal(r.length, records.length, 'number created is correct')
    t.equal(arrayProxy.find(r, record => record.id === 1).picture, null,
      'missing singular value is null')
    t.deepEqual(arrayProxy.find(r, record => record.id === 1).nicknames,
      [], 'missing array value is empty array')
    return fn(t, adapter)
  })
  .then(() => adapter.delete(type))
  .then(number => {
    t.equal(number, records.length, 'number deleted is correct')
    return adapter.disconnect()
  })
  .then(t.end)
  .catch(error => {
    stderr.error(error)
    adapter.disconnect()
    t.fail(error)
    t.end()
  })
}
