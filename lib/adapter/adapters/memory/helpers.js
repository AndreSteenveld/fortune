'use strict'

var clone = require('clone')
var common = require('../common')
var generateId = common.generateId


exports.inputRecord = function (type, record) {
  var recordTypes = this.recordTypes
  var primaryKey = this.keys.primary
  var isArrayKey = this.keys.isArray
  var fields = recordTypes[type]
  var fieldsArray = Object.getOwnPropertyNames(fields)
  var result = {}
  var i, field

  // ID business.
  result[primaryKey] = primaryKey in record ?
    record[primaryKey] : generateId()

  for (i = fieldsArray.length; i--;) {
    field = fieldsArray[i]
    if (!(field in record)) {
      result[field] = fields[field][isArrayKey] ? [] : null
      continue
    }

    result[field] = clone(record[field])
  }

  return result
}


exports.outputRecord = function (type, record) {
  var recordTypes = this.recordTypes
  var primaryKey = this.keys.primary
  var isArrayKey = this.keys.isArray
  var denormalizedInverseKey = this.keys.denormalizedInverse
  var fields = recordTypes[type]
  var fieldsArray = Object.getOwnPropertyNames(fields)
  var result = {}
  var i, field, value

  // ID business.
  result[primaryKey] = record[primaryKey]

  for (i = fieldsArray.length; i--;) {
    field = fieldsArray[i]
    value = field in record ? clone(record[field]) :
      fields[field][isArrayKey] ? [] : null

    // Do not enumerate denormalized fields.
    if (fields[field][denormalizedInverseKey]) {
      Object.defineProperty(result, field, {
        configurable: true, writable: true, value: value
      })
      continue
    }

    result[field] = value
  }

  return result
}
