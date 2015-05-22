import test from 'tape'
import Serializer from '../../../lib/serializer'
import generateApp from '../generate_app'
import * as stderr from '../../stderr'
import * as arrayProxy from '../../../lib/common/array_proxy'


test('update one to one with 2nd degree unset', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 3,
      replace: { spouse: 2 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 1).spouse, null,
      '2nd degree related field unset')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).spouse, 3,
      'related field set')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 3).spouse, 2,
      'field updated')
  }
}))


test('update one to one with former related record', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 2,
      replace: { spouse: 3 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 1).spouse, null,
      'related field unset')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).spouse, 3,
      'field updated')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 3).spouse, 2,
      'related field set')
  }
}))


test('update one to one with same value', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 2,
      replace: { spouse: 1 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 1).spouse, 2,
      'related field is same')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).spouse, 1,
      'field is same')
  }
}))


test('update one to one with null value', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 2,
      replace: { spouse: null }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 1).spouse, null,
      'related field is updated')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).spouse, null,
      'field is updated')
  }
}))


test('update one to many (set)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].animal,
      [ 1 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows related update IDs')
  },
  type: 'animal',
  payload: [
    {
      id: 1,
      replace: { owner: 2 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 1).pets, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).pets.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'related field pushed')
  }
}))


test('update one to many (unset)', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].animal,
      [ 1 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1 ], 'change event shows related update IDs')
  },
  type: 'animal',
  payload: [
    {
      id: 1,
      replace: { owner: null }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 1).pets, [],
      'related field pulled')
  }
}))


test('update many to one (push)', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal,
      [ 1 ], 'change event shows related update IDs')
  },
  type: 'user',
  payload: [
    {
      id: 2,
      push: { pets: 1 }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 1).owner, 2,
      'related field set')
  }
}))


test('update many to one (push) with 2nd degree', updateTest.bind({
  plan: 3,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user,
      [ 1, 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal,
      [ 2 ], 'change event shows related update IDs')
  },
  type: 'user',
  payload: [
    {
      id: 1,
      push: { pets: 2 }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).owner, 1,
      'related field set')
  }
}))


test('update many to one (pull)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user,
      [ 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal,
      [ 2, 3 ], 'change event shows related update IDs')
  },
  type: 'user',
  payload: [
    {
      id: 2,
      pull: { pets: [ 2, 3 ] }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).owner, null,
      'related field set')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 3).owner, null,
      'related field set')
  }
}))


test('update many to one (set)', updateTest.bind({
  plan: 5,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 3,
      replace: { pets: [ 1, 2, 3 ] }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 1).pets, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).pets, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 3).pets, [ 1, 2, 3 ],
      'field set')
  }
}))


test('update many to one (set) #2', updateTest.bind({
  plan: 3,
  type: 'user',
  payload: [
    {
      id: 3,
      replace: { pets: [ 1, 2, 3 ] }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 1).owner, 3,
      'related field set')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).owner, 3,
      'related field set')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 3).owner, 3,
      'related field set')
  }
}))


test('update many to one (set) #3', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal.sort((a, b) => a - b),
      [ 1, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 2,
      replace: { pets: [ 1, 2 ] }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 1).pets, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).pets, [ 1, 2 ],
      'field set')
  }
}))


test('update many to one (unset)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 2 ], 'change event shows updated IDs')
    t.deepEqual(data[methods.update].animal.sort((a, b) => a - b),
      [ 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 2,
      replace: { pets: [] }
    }
  ],
  relatedType: 'animal',
  related: (t, response) => {
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 2).owner, null,
      'related field unset')
    t.equal(arrayProxy.find(response.payload.records,
      record => record.id === 3).owner, null,
      'related field unset')
  }
}))


test('update many to many (push)', updateTest.bind({
  plan: 2,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 1,
      push: { friends: 2 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).friends.sort((a, b) => a - b),
      [ 1, 3 ], 'related ID pushed')
  }
}))


test('update many to many (pull)', updateTest.bind({
  plan: 2,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 3,
      pull: { friends: 2 }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).friends, [],
      'related ID pulled')
  }
}))


test('update many to many (set)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 1,
      replace: { friends: [ 2, 3 ] }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 1).friends.sort((a, b) => a - b),
      [ 2, 3 ], 'field set')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).friends.sort((a, b) => a - b),
      [ 1, 3 ], 'related field pushed')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 3).friends.sort((a, b) => a - b),
      [ 1, 2 ], 'field unchanged')
  }
}))


test('update many to many (unset)', updateTest.bind({
  plan: 4,
  change: (t, methods, data) => {
    t.deepEqual(data[methods.update].user.sort((a, b) => a - b),
      [ 1, 2, 3 ], 'change event shows updated IDs')
  },
  type: 'user',
  payload: [
    {
      id: 3,
      replace: { friends: [] }
    }
  ],
  relatedType: 'user',
  related: (t, response) => {
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 1).friends, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 2).friends, [],
      'related field pulled')
    t.deepEqual(arrayProxy.find(response.payload.records,
      record => record.id === 3).friends, [],
      'field set')
  }
}))


function updateTest (t) {
  const { type, payload } = this
  let app
  let methods
  let change

  class DefaultSerializer extends Serializer {}
  DefaultSerializer.id = Symbol()

  t.plan(this.plan)

  generateApp({
    serializers: [ { type: DefaultSerializer } ]
  })

  .then(a => {
    app = a
    ; ({ methods, change } = app.dispatcher)

    if (this.change)
      app.dispatcher.on(change, data =>
        this.change.call(this, t, methods, data))

    return app.dispatch({
      serializerInput: DefaultSerializer.id,
      serializerOutput: DefaultSerializer.id,
      method: methods.update,
      type, payload
    })
  })

  .then(() => app.dispatch({
    serializerOutput: DefaultSerializer.id,
    type: this.relatedType,
    method: methods.find
  }))

  .then(this.related.bind(this, t))

  .then(() => app.stop())

  .then(() => t.end())

  .catch(error => {
    stderr.error(error)
    app.stop()
    t.fail(error)
    t.end()
  })
}
