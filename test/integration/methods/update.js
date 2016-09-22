'use strict'

const tapdance = require('tapdance')
const pass = tapdance.pass
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok

const testInstance = require('../test_instance')
const stderr = require('../../stderr')

const find = require('../../../lib/common/array/find')
const deepEqual = require('../../../lib/common/deep_equal')

const constants = require('../../../lib/common/constants')
const changeEvent = constants.change
const updateMethod = constants.update
const primaryKey = constants.primary

const errors = require('../../../lib/common/errors')
const ConflictError = errors.ConflictError
const BadRequestError = errors.BadRequestError
const NotFoundError = errors.NotFoundError


run(() => {
  comment('update missing record should fail')
  return updateTest({
    type: 'user',
    payload: {
      [primaryKey]: 'xxx',
      replace: { spouse: 1 }
    },
    error: error => {
      ok(error instanceof NotFoundError, 'error type is correct')
    }
  })
})


run(() => {
  comment('update invalid ID should fail')
  return updateTest({
    type: 'user',
    payload: {
      [primaryKey]: 2,
      push: { ownedPets: 'xxx' }
    },
    error: error => {
      ok(error instanceof BadRequestError, 'error type is correct')
    }
  })
})


run(() => {
  comment('update one to one with 2nd degree unset')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2, 3 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 3,
      replace: { spouse: 2 }
    },
    relatedType: 'user',
    related: response => {
      ok(find(response.payload.records,
        record => record[primaryKey] === 1).spouse === null,
        '2nd degree related field unset')
      ok(find(response.payload.records,
        record => record[primaryKey] === 2).spouse === 3,
        'related field set')
      ok(find(response.payload.records,
        record => record[primaryKey] === 3).spouse === 2,
        'field updated')
    }
  })
})


run(() => {
  comment('update one to one with former related record')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2, 3 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 2,
      replace: { spouse: 3 }
    },
    relatedType: 'user',
    related: response => {
      ok(find(response.payload.records,
        record => record[primaryKey] === 1).spouse === null,
        'related field unset')
      ok(find(response.payload.records,
        record => record[primaryKey] === 2).spouse === 3,
        'field updated')
      ok(find(response.payload.records,
        record => record[primaryKey] === 3).spouse === 2,
        'related field set')
    }
  })
})


run(() => {
  comment('update one to one with same value')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 2 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 2,
      replace: { spouse: 1 }
    },
    relatedType: 'user',
    related: response => {
      ok(find(response.payload.records,
        record => record[primaryKey] === 1).spouse === 2,
        'related field is same')
      ok(find(response.payload.records,
        record => record[primaryKey] === 2).spouse === 1,
        'field is same')
    }
  })
})


run(() => {
  comment('update one to one with multiple same value should fail')

  return testInstance()
  .then(store => store.update('user', [
      { [primaryKey]: 2, replace: { spouse: 1 } },
      { [primaryKey]: 3, replace: { spouse: 1 } }
    ]
  ))
  .then(() => {
    fail('should have failed')
  })
  .catch(() => {
    pass('multiple same values failed')
  })
})


run(() => {
  comment('update one to one with null value')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 2,
      replace: { spouse: null }
    },
    relatedType: 'user',
    related: response => {
      ok(find(response.payload.records,
        record => record[primaryKey] === 1).spouse === null,
        'related field is updated')
      ok(find(response.payload.records,
        record => record[primaryKey] === 2).spouse === null,
        'field is updated')
    }
  })
})


run(() => {
  comment('update one to many (no inverse updates)')
  return updateTest({
    change: data => {
      ok(data[updateMethod].animal[0].replace.owner === 1,
        'change event is empty')
    },
    type: 'animal',
    payload: {
      [primaryKey]: 1,
      replace: { owner: 1 }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 1).ownedPets, [ 1 ]),
        'related field is correct')
    }
  })
})


run(() => {
  comment('update one to many (set)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].animal
        .map(x => x.id).sort((a, b) => a - b),
        [ 1 ]), 'change event shows updated IDs')
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]), 'change event shows related update IDs')
    },
    type: 'animal',
    payload: {
      [primaryKey]: 1,
      replace: { owner: 2 }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 1).ownedPets, []),
        'related field pulled')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 2).ownedPets.sort((a, b) => a - b),
        [ 1, 2, 3 ]), 'related field pushed')
    }
  })
})


run(() => {
  comment('update one to many (unset)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].animal
        .map(x => x.id).sort((a, b) => a - b),
        [ 1 ]), 'change event shows updated IDs')
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1 ]), 'change event shows related update IDs')
    },
    type: 'animal',
    payload: {
      [primaryKey]: 1,
      replace: { owner: null }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 1).ownedPets, []),
        'related field pulled')
    }
  })
})


run(() => {
  comment('update many to one (push)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]), 'change event shows updated IDs')
      ok(deepEqual(data[updateMethod].animal
        .map(x => x.id).sort((a, b) => a - b),
        [ 1 ]), 'change event shows related update IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 2,
      push: { ownedPets: 1 }
    },
    relatedType: 'animal',
    related: response => {
      ok(find(response.payload.records,
        record => record[primaryKey] === 1).owner === 2,
        'related field set')
    }
  })
})


run(() => {
  comment('update many to one (push, conflict)')
  return updateTest({
    type: 'user',
    payload: {
      [primaryKey]: 2,
      push: { ownedPets: 2 }
    },
    error: error => {
      ok(error instanceof ConflictError, 'error type is correct')
    }
  })
})


run(() => {
  comment('update many to one (push) with 2nd degree')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]), 'change event shows updated IDs')
      ok(deepEqual(data[updateMethod].animal
        .map(x => x.id).sort((a, b) => a - b),
        [ 2 ]), 'change event shows related update IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 1,
      push: { ownedPets: 2 }
    },
    relatedType: 'animal',
    related: response => {
      ok(find(response.payload.records,
        record => record[primaryKey] === 2).owner === 1,
        'related field set')
    }
  })
})


run(() => {
  comment('update many to one (pull)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 2 ]), 'change event shows updated IDs')
      ok(deepEqual(data[updateMethod].animal
        .map(x => x.id).sort((a, b) => a - b),
        [ 2, 3 ]), 'change event shows related update IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 2,
      pull: { ownedPets: [ 2, 3 ] }
    },
    relatedType: 'animal',
    related: response => {
      ok(find(response.payload.records,
        record => record[primaryKey] === 2).owner === null,
        'related field set')
      ok(find(response.payload.records,
        record => record[primaryKey] === 3).owner === null,
        'related field set')
    }
  })
})


run(() => {
  comment('update many to one (set)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2, 3 ]), 'change event shows updated IDs')
      ok(deepEqual(data[updateMethod].animal
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2, 3 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 3,
      replace: { ownedPets: [ 1, 2, 3 ] }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 1).ownedPets, []),
        'related field pulled')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 2).ownedPets, []),
        'related field pulled')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 3).ownedPets, [ 1, 2, 3 ]),
        'field set')
    }
  })
})


run(() => {
  comment('update many to one (set) #2')
  return updateTest({
    type: 'user',
    payload: {
      [primaryKey]: 3,
      replace: { ownedPets: [ 1, 2, 3 ] }
    },
    relatedType: 'animal',
    related: response => {
      ok(find(response.payload.records,
        record => record[primaryKey] === 1).owner === 3,
        'related field set')
      ok(find(response.payload.records,
        record => record[primaryKey] === 2).owner === 3,
        'related field set')
      ok(find(response.payload.records,
        record => record[primaryKey] === 3).owner === 3,
        'related field set')
    }
  })
})


run(() => {
  comment('update many to one (set) #3')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]), 'change event shows updated IDs')
      ok(deepEqual(data[updateMethod].animal
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 3 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 2,
      replace: { ownedPets: [ 1, 2 ] }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 1).ownedPets, []),
        'related field pulled')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 2).ownedPets, [ 1, 2 ]),
        'field set')
    }
  })
})


run(() => {
  comment('update many to one (unset)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 2 ]), 'change event shows updated IDs')
      ok(deepEqual(data[updateMethod].animal
        .map(x => x.id).sort((a, b) => a - b),
        [ 2, 3 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 2,
      replace: { ownedPets: [] }
    },
    relatedType: 'animal',
    related: response => {
      ok(find(response.payload.records,
        record => record[primaryKey] === 2).owner === null,
        'related field unset')
      ok(find(response.payload.records,
        record => record[primaryKey] === 3).owner === null,
        'related field unset')
    }
  })
})


run(() => {
  comment('update many to many (push)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 1,
      push: { friends: 2 }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 2).friends.sort((a, b) => a - b),
        [ 1, 3 ]), 'related ID pushed')
    }
  })
})


run(() => {
  comment('update many to many (push, conflict)')
  return updateTest({
    type: 'user',
    payload: {
      [primaryKey]: 1,
      push: { friends: 3 }
    },
    error: error => {
      ok(error instanceof ConflictError, 'error type is correct')
    }
  })
})


run(() => {
  comment('update many to many (pull)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 2, 3 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 3,
      pull: { friends: 2 }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 2).friends, []),
        'related ID pulled')
    }
  })
})


run(() => {
  comment('update many to many (set)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 1,
      replace: { friends: [ 2, 3 ] }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 1).friends.sort((a, b) => a - b),
        [ 2, 3 ]), 'field set')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 2).friends.sort((a, b) => a - b),
        [ 1, 3 ]), 'related field pushed')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 3).friends.sort((a, b) => a - b),
        [ 1, 2 ]), 'field unchanged')
    }
  })
})


run(() => {
  comment('update many to many (set, conflict)')
  return updateTest({
    type: 'user',
    payload: {
      [primaryKey]: 1,
      replace: { friends: [ 3, 3 ] }
    },
    error: error => {
      ok(error instanceof ConflictError, 'error type is correct')
    }
  })
})


run(() => {
  comment('update many to many (unset)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2, 3 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 3,
      replace: { friends: [] }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 1).friends, []),
        'related field pulled')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 2).friends, []),
        'related field pulled')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 3).friends, []),
        'field set')
    }
  })
})


run(() => {
  comment('update many to many (denormalized inverse)')
  return updateTest({
    change: data => {
      ok(deepEqual(data[updateMethod].user
        .map(x => x.id).sort((a, b) => a - b),
        [ 1, 2, 3 ]), 'change event shows updated IDs')
    },
    type: 'user',
    payload: {
      [primaryKey]: 1,
      replace: { enemies: [ 2, 3 ] }
    },
    relatedType: 'user',
    related: response => {
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 1).enemies.sort((a, b) => a - b),
        [ 2, 3 ]), 'field set')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 1)['__user_enemies_inverse'],
        []), 'denormalized inverse field exists')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 2)['__user_enemies_inverse'],
        [ 1 ]), 'related field updated')
      ok(deepEqual(find(response.payload.records,
        record => record[primaryKey] === 3)['__user_enemies_inverse']
        .sort((a, b) => a - b), [ 1, 2 ]), 'related field updated')
    }
  })
})


function updateTest (o) {
  let store

  return testInstance()

  .then(instance => {
    store = instance

    if (o.change)
      store.on(changeEvent, data => o.change(data))

    return store.update(o.type, o.payload)
  })

  .then(x => o.relatedType ? store.find(o.relatedType) : null)

  .then(response => response ? o.related(response) : null)

  .then(() => {
    if (o.error) throw new Error('Test should have failed.')

    return store.disconnect()
  })

  .catch(error => {
    stderr.error(error)
    store.disconnect()

    if (o.error) o.error(error)
    else fail(error)
  })
}
