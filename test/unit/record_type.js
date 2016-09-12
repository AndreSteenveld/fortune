'use strict'

const assert = require('assert')
const tapdance = require('tapdance')
const pass = tapdance.pass
const fail = tapdance.fail
const comment = tapdance.comment
const run = tapdance.run
const ok = tapdance.ok

const ensureTypes = require('../../lib/record_type/ensure_types')
const validate = require('../../lib/record_type/validate')
const enforce = require('../../lib/record_type/enforce')
const deepEqual = require('../../lib/common/deep_equal')

const keys = require('../../lib/common/keys')
const primaryKey = keys.primary
const linkKey = keys.link
const isArrayKey = keys.isArray
const inverseKey = keys.inverse
const denormalizedInverseKey = keys.denormalizedInverse

const alloc = Buffer.alloc || Buffer
const recordType = 'person'
const fields = {
  // Shorthand definitions.
  s1: String,
  s2: Array(String),
  s3: [ 'person', 's4' ],
  s4: [ Array('person'), 's3' ],
  s5: 'person',
  s6: Array('person'),

  // Standard definitions.
  name: { type: String },
  birthdate: { type: Date, junk: 'asdf' },
  mugshot: { type: Buffer },
  integer: { type: Integer },
  luckyNumbers: { type: Number, isArray: true },
  friends: { link: 'person', isArray: true, inverse: 'friends' },
  spouse: { link: 'person', inverse: 'spouse' },
  toys: { type: Object, isArray: true }
}


const testFields = fields => () => validate(fields)
const testField = field => () => validate({ [field]: fields[field] })
const getField = field => testField(field)()[field]


run(() => {
  comment('validate field definition')

  // Test for valid fields.
  const valid = 'valid field is valid'

  // Shorthand.
  pass(() => assert.deepEqual(getField('s1'), {
    type: String
  }), valid)
  pass(() => assert.deepEqual(getField('s2'), {
    type: String, isArray: true
  }), valid)
  pass(() => assert.deepEqual(getField('s3'), {
    link: 'person', inverse: 's4'
  }), valid)
  pass(() => assert.deepEqual(getField('s4'), {
    link: 'person', inverse: 's3', isArray: true
  }), valid)
  pass(() => assert.deepEqual(getField('s5'), {
    link: 'person'
  }), valid)
  pass(() => assert.deepEqual(getField('s6'), {
    link: 'person', isArray: true
  }), valid)

  // Standard.
  pass(testField('name'), valid)
  pass(testField('birthdate'), valid)
  pass(testField('mugshot'), valid)
  pass(testField('luckyNumbers'), valid)
  pass(testField('friends'), valid)
  pass(testField('toys'), valid)
  pass(testField('integer'), valid)

  // Test for invalid fields.
  const invalid = 'invalid field throws error'

  fail(testFields({ badType: true }), invalid)
  fail(testFields({ nested: { thing: { type: String } } }), invalid)
  fail(testFields({
    typeAndLink: { type: String, link: 'y', inverse: 'friends' }
  }), invalid)
  fail(testFields({ nonexistent: NaN }), invalid)
  fail(testFields({ nullEdgeCase: null }), invalid)
  fail(testFields({ fake: { type: 'x' } }), invalid)
})


run(() => {
  comment('enforce field definition')

  const testRecord = record => () => enforce(recordType, record, fields)
  const bad = 'bad type is bad'
  const good = 'good type is good'

  fail(testRecord({ [primaryKey]: 1, spouse: 1 }), bad)
  fail(testRecord({ spouse: [ 2 ] }), bad)
  fail(testRecord({ friends: 2 }), bad)
  fail(testRecord({ [primaryKey]: 1, friends: [ 1 ] }), bad)
  fail(testRecord({ name: {} }), bad)
  pass(testRecord({ name: '' }), good)
  fail(testRecord({ birthdate: {} }), bad)
  pass(testRecord({ birthdate: new Date() }), good)
  fail(testRecord({ mugshot: {} }), bad)
  pass(testRecord({ mugshot: alloc(1) }), good)
  fail(testRecord({ luckyNumbers: 1 }), bad)
  pass(testRecord({ luckyNumbers: [ 1 ] }), good)
  pass(testRecord({ integer: 1 }), good)
  fail(testRecord({ integer: 1.1 }), bad)
  fail(testRecord({
    [primaryKey]: 1,
    friends: [ 0, 1, 2 ] }
  ), 'record cannot link to itself')
  ok(deepEqual(enforce(recordType,
    { friends: [ 'a', 'b', 'c', 1, 2, 3 ] }, fields).friends,
    [ 'a', 'b', 'c', 1, 2, 3 ]), 'links are untouched')
  ok(
    enforce(recordType, { random: 'abc' }, fields).random === void 0,
    'arbitrary fields are dropped')
})


run(() => {
  comment('ensure record types')
  const check = recordTypes => () => ensureTypes(recordTypes)

  fail(check({
    post: {
      comments: { link: 'comment', isArray: true }
    }
  }), 'record type must exist')

  fail(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    }
  }), 'inverse must exist')

  fail(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    },
    comment: {
      post: { link: 'post', inverse: 'foo' }
    }
  }), 'inverse is incorrect')

  fail(check({
    post: {
      comments: { link: 'comment', inverse: 'post' }
    },
    comment: {
      post: { link: 'foo', inverse: 'comments' }
    }
  }), 'inverse link is incorrect')

  pass(check({
    post: {
      comments: { link: 'comment', isArray: true, inverse: 'post' }
    },
    comment: {
      post: { link: 'post', inverse: 'comments' }
    }
  }), 'valid linking')

  pass(check({
    user: {
      friends: { link: 'user', isArray: true, inverse: 'friends' }
    }
  }), 'self inverse is valid')

  const recordTypes = {
    post: {
      comments: { link: 'comment', isArray: true }
    },
    comment: {}
  }

  ensureTypes(recordTypes)

  const denormalizedField = '__post_comments_inverse'

  ok(recordTypes.post.comments[inverseKey] === denormalizedField,
    'denormalized inverse field assigned')

  ok(recordTypes.comment[denormalizedField][linkKey] === 'post',
    'denormalized inverse field link correct')

  ok(recordTypes.comment[denormalizedField][isArrayKey] === true,
    'denormalized inverse field is array')

  ok(recordTypes.comment[denormalizedField][denormalizedInverseKey] === true,
    'denormalized inverse field set')
})


function Integer (x) { return (x | 0) === x }
Integer.prototype = Object.create(Number.prototype)
