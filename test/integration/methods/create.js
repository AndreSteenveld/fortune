import { pass, fail, run, comment, ok, deepEqual, equal } from 'tapdance'
import testInstance from '../test_instance'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array'

var constants = require('../../../lib/common/constants')
var changeEvent = constants.change
var createMethod = constants.create
var updateMethod = constants.update
var primaryKey = constants.primary


const deadcode = new Buffer('deadc0de', 'hex')

const records = [
  {
    [primaryKey]: 4,
    name: 'Slimer McGee',
    birthday: new Date(2011, 5, 30),
    friends: [ 1, 3 ],
    picture: deadcode
  }
]


run(() => {
  comment('create record')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    store.on(changeEvent, data => {
      deepEqual(data[createMethod].user.sort((a, b) => a - b),
        [ 4 ], 'change event shows created IDs')
      deepEqual(data[updateMethod].user.sort((a, b) => a - b),
        [ 1, 3 ], 'change event shows updated IDs')
    })

    return store.request({
      type: 'user',
      method: createMethod,
      payload: records
    })
  })

  .then(response => {
    ok(deadcode.equals(response.payload[0].picture) &&
      deadcode.equals(records[0].picture),
      'input object not mutated')
    equal(response.payload.length, 1, 'record created')
    equal(response.payload[0][primaryKey], 4, 'record has correct ID')
    ok(response.payload[0].birthday instanceof Date,
      'field has correct type')
    equal(response.payload[0].name, 'Slimer McGee',
      'record has correct field value')

    return store.request({
      type: 'user',
      ids: [ 1, 3 ]
    })
  })

  .then(response => {
    deepEqual(response.payload.map(record =>
      arrayProxy.find(record.friends, id => id === 4)),
      [ 4, 4 ], 'related records updated')

    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()
    fail(error)
  })
})


run(() => {
  comment('create records with same to-one relationship should fail')

  let store

  return testInstance()

  .then(instance => {
    store = instance

    return store.request({
      type: 'user',
      method: createMethod,
      payload: [ { spouse: 2 }, { spouse: 2 } ]
    })
  })

  .then(() => {
    fail('should have failed')
  })
  .catch(() => {
    pass('should reject request')
  })
})
