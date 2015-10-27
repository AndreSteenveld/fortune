'use strict'

// Local modules.
var Core = require('./core')
var assign = require('./common/assign')
var defineEnumerable = require('./common/define_enumerable')

// Static exports.
var memory = require('./adapter/adapters/memory')
var json = require('./serializer/serializers/json')
var form = require('./serializer/serializers/form')
var http = require('./net/http')
var websocket = require('./net/websocket')


var adapters = {
  memory: memory
}
var serializers = {
  json: json,
  formUrlEncoded: form.formUrlEncoded,
  formData: form.formData
}
var net = {
  http: http,
  websocket: websocket
}


/**
 * This class just extends Core with some default serializers and static
 * properties.
 */
function Fortune (options) {
  if (!(this instanceof Fortune)) return new Fortune(options)
  if (options === void 0) options = Object.create(null)

  if (!('serializers' in options))
    options.serializers = Object.keys(serializers).map(function (name) {
      return { type: serializers[name] }
    })

  this.constructor(options)
}


Fortune.prototype = Object.create(Core.prototype)
assign(Fortune, Core)


Fortune.create = function (options) {
  return new Fortune(options)
}


// Assign useful static properties to the default export.
defineEnumerable(Fortune, {
  adapters: adapters,
  serializers: serializers,
  net: net
})


module.exports = Fortune
